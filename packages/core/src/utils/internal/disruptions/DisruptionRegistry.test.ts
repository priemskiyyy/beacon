import { expect, test, vi } from "vitest";

import { createTestClock } from "src/mock/createTestClock";
import type { DisruptionParticipant } from "src/types/DisruptionParticipant";
import type { ReserveContext } from "src/types/ReserveContext";
import type { Settlement } from "src/types/Settlement";
import { createDeferred } from "src/utils/internal/common/createDeferred";
import { DisruptionRegistry } from "src/utils/internal/disruptions/DisruptionRegistry";

const RELOAD: ReserveContext = {
  route: "web",
  command: "reload",
  impacts: ["document-replacement"],
};

const createRegistry = () => {
  const clock = createTestClock();
  const reportError = vi.fn();

  const registry = new DisruptionRegistry({
    clock,
    timeout: 1_000,
    reportError,
  });

  return { registry, clock, reportError };
};

type Options = {
  impacts?: DisruptionParticipant["impacts"];
  settle?: () => Promise<Settlement>;
  release?: () => void;
};

const createParticipant = (
  name: string,
  log: string[],
  { impacts = ["document-replacement"], settle, release }: Options = {},
): DisruptionParticipant => ({
  name,
  impacts,
  reserve: () => {
    log.push(`${name} reserved`);

    return {
      status: "reserved",
      ...(settle === undefined ? {} : { settle }),
      release: () => {
        log.push(`${name} released`);
        release?.();
      },
    };
  },
});

test("SAFE-02 a reservation closes admission synchronously, before any settlement begins", async () => {
  const { registry } = createRegistry();
  const log: string[] = [];

  registry.register(
    createParticipant("drafts", log, {
      settle: async () => {
        log.push("drafts settling");

        return { status: "ready" };
      },
    }),
  );

  const outcome = registry.reserve(RELOAD);

  expect(log).toEqual(["drafts reserved"]);

  if (outcome.status !== "reserved") {
    throw new Error("The reservation should have been taken.");
  }

  await expect(
    outcome.lease.settle(new AbortController().signal),
  ).resolves.toEqual([]);
  expect(log).toEqual(["drafts reserved", "drafts settling"]);
});

test("SAFE-03 a later participant that blocks releases the earlier reservations in reverse", () => {
  const { registry } = createRegistry();
  const log: string[] = [];

  registry.register(createParticipant("first", log));
  registry.register(createParticipant("second", log));
  registry.register({
    name: "third",
    impacts: ["document-replacement"],
    reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
  });

  expect(registry.reserve(RELOAD)).toEqual({
    status: "blocked",
    reasons: [{ code: "unsaved-draft", participant: { name: "third" } }],
  });
  expect(log).toEqual([
    "first reserved",
    "second reserved",
    "second released",
    "first released",
  ]);
});

test("a participant whose reservation throws blocks the command and the others are released", () => {
  const { registry, reportError } = createRegistry();
  const log: string[] = [];
  const failure = new Error("The participant is broken.");

  registry.register(createParticipant("first", log));
  registry.register({
    name: "broken",
    impacts: ["document-replacement"],
    reserve: () => {
      throw failure;
    },
  });

  expect(registry.reserve(RELOAD)).toEqual({
    status: "blocked",
    reasons: [{ code: "reservation-failed", participant: { name: "broken" } }],
  });
  expect(log).toEqual(["first reserved", "first released"]);
  expect(reportError).toHaveBeenCalledWith(failure);
});

test("SAFE-05 a release that throws is reported and the remaining releases still run", () => {
  const { registry, reportError } = createRegistry();
  const log: string[] = [];
  const failure = new Error("The release threw.");

  registry.register(createParticipant("first", log));
  registry.register(
    createParticipant("second", log, {
      release: () => {
        throw failure;
      },
    }),
  );

  const outcome = registry.reserve(RELOAD);

  if (outcome.status !== "reserved") {
    throw new Error("The reservation should have been taken.");
  }

  outcome.lease.release();

  expect(log).toEqual([
    "first reserved",
    "second reserved",
    "second released",
    "first released",
  ]);
  expect(reportError).toHaveBeenCalledWith(failure);
});

test("a participant asks only when the command has an impact it cares about", () => {
  const { registry } = createRegistry();
  const log: string[] = [];

  registry.register(
    createParticipant("uploads", log, { impacts: ["javascript-restart"] }),
  );

  expect(registry.reserve(RELOAD).status).toBe("reserved");
  expect(log).toEqual([]);
});

test("SAFE-04 a settlement that says blocked, throws or takes too long is not ready", async () => {
  const { registry, clock, reportError } = createRegistry();
  const log: string[] = [];
  const never = createDeferred<Settlement>();

  registry.register(
    createParticipant("blocking", log, {
      settle: async () => ({ status: "blocked", code: "draft-not-saved" }),
    }),
  );
  registry.register(
    createParticipant("throwing", log, {
      settle: () => Promise.reject(new Error("The save failed.")),
    }),
  );
  registry.register(
    createParticipant("silent", log, { settle: () => never.promise }),
  );

  const outcome = registry.reserve(RELOAD);

  if (outcome.status !== "reserved") {
    throw new Error("The reservation should have been taken.");
  }

  const settling = outcome.lease.settle(new AbortController().signal);

  clock.advance(1_000);

  await expect(settling).resolves.toEqual([
    { code: "draft-not-saved", participant: { name: "blocking" } },
    { code: "settlement-failed", participant: { name: "throwing" } },
    { code: "settlement-timeout", participant: { name: "silent" } },
  ]);
  expect(reportError).toHaveBeenCalledTimes(1);
});

test("SAFE-06 the revision grows when a participant registers or leaves, once per change", () => {
  const { registry } = createRegistry();
  const log: string[] = [];

  expect(registry.getRevision()).toBe(0);

  const unregister = registry.register(createParticipant("drafts", log));

  expect(registry.getRevision()).toBe(1);
  expect(registry.reserve(RELOAD)).toMatchObject({
    status: "reserved",
    lease: { revision: 1 },
  });

  unregister();
  unregister();

  expect(registry.getRevision()).toBe(2);
  expect(registry.size()).toBe(0);
});
