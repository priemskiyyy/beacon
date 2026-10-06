import { expect, test, vi } from "vitest";

import type { JournalOptions } from "src/types/JournalOptions";
import type { RunningRelease } from "src/types/RunningRelease";
import { createMockSource } from "src/mock/createMockSource";
import {
  buildWebRelease,
  createBeacon,
  createRoutedBeacon,
  settle,
} from "src/utils/Beacon.fixture";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { createMemoryStorage } from "src/utils/journal.fixture";
import { targetRoute } from "src/utils/targetRoute";
import type { Manifest } from "src/utils/routes.fixture";
import { createDeferred } from "src/utils/internal/common/createDeferred";

test("a synchronous reader makes its subject known with a frozen copy", async () => {
  const release = buildWebRelease("web-build-a");

  const { beacon } = createBeacon({
    running: { boot: { id: "boot-1" }, web: () => release },
  });

  beacon.start();
  await settle();

  const { web, revision } = beacon.running.get();

  expect(revision).toBe(1);
  expect(web).toMatchObject({ state: "known", readAt: 1_000 });

  if (web.state !== "known") {
    throw new Error("The web fact is not known.");
  }

  expect(web.release).toEqual(release);
  expect(web.release).not.toBe(release);
  expect(Object.isFrozen(web.release)).toBe(true);
  expect(Object.isFrozen(web.release.identity)).toBe(true);
  expect(Object.isFrozen(web.release.raw)).toBe(true);
});

test("CORE-14 a subject stays pending until its reader answers, and the others are independent", async () => {
  const held = createDeferred<RunningRelease>();

  const { beacon } = createBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => buildWebRelease("web-build-a"),
      native: () => held.promise,
    },
  });

  beacon.start();
  await settle();

  expect(beacon.running.get().web.state).toBe("known");
  expect(beacon.running.get().native).toEqual({ state: "pending" });
  expect(beacon.running.get().bundle).toEqual({ state: "unconfigured" });

  held.resolve(buildWebRelease("native-1"));
  await settle();

  expect(beacon.running.get().native.state).toBe("known");
  expect(beacon.running.get().revision).toBe(2);
});

test("a reader that throws, rejects or is too slow fails only its own subject", async () => {
  const never = createDeferred<RunningRelease>();

  const { beacon, clock } = createBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => {
        throw new Error("The build constant is missing.");
      },
      native: () => Promise.reject(new Error("The native module is gone.")),
      bundle: () => never.promise,
      worker: () => buildWebRelease("worker-1"),
    },
    timeouts: { running: 500 },
  });

  beacon.start();
  await settle();
  clock.advance(500);
  await settle();

  const { web, native, bundle, worker } = beacon.running.get();

  expect(web).toEqual({
    state: "failed",
    error: {
      code: "RUNNING_READ_FAILED",
      message: "A running fact could not be read.",
    },
  });
  expect(native.state).toBe("failed");
  expect(bundle).toEqual({
    state: "failed",
    error: {
      code: "RUNNING_READ_FAILED",
      message: "A running fact was not read in time.",
    },
  });
  expect(worker.state).toBe("known");
});

test("CORE-06 a read that changes nothing keeps the snapshot and its revision", async () => {
  const { beacon } = createBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => buildWebRelease("web-build-a"),
    },
  });

  const listener = vi.fn();

  beacon.start();
  await settle();

  const snapshot = beacon.running.get();

  beacon.running.subscribe(listener);
  beacon.stop();
  beacon.start();
  await settle();

  expect(beacon.running.get()).toBe(snapshot);
  expect(listener).not.toHaveBeenCalled();
});

test("LIFE-01 an answer that arrives after the session ended changes nothing and is counted", async () => {
  const held = createDeferred<RunningRelease>();

  const { beacon } = createBeacon({
    running: { boot: { id: "boot-1" }, web: () => held.promise },
  });

  const stop = beacon.start();

  stop();
  held.resolve(buildWebRelease("web-build-a"));
  await settle();

  expect(beacon.running.get().web).toEqual({ state: "pending" });
  expect(beacon.diagnostics.get().counters.lateCallbacks).toBe(1);
});

test("a newer read of a subject supersedes an older one still in flight", async () => {
  const first = createDeferred<RunningRelease>();
  const second = createDeferred<RunningRelease>();
  const readers = [() => first.promise, () => second.promise];

  const { beacon } = createBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => {
        const reader = readers.shift();

        if (reader === undefined) {
          throw new Error("No reader is left.");
        }

        return reader();
      },
    },
  });

  beacon.start();
  beacon.stop();
  beacon.start();
  first.resolve(buildWebRelease("web-build-old"));
  second.resolve(buildWebRelease("web-build-new"));
  await settle();

  const { web } = beacon.running.get();

  expect(web.state).toBe("known");
  expect(web.state === "known" && web.release.identity).toMatchObject({
    value: "web-build-new",
  });
});

test("SEC-05 a failed fact keeps its code and message and never the cause", async () => {
  const { beacon } = createBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => {
        throw new Error("https://user:secret@example.com/build");
      },
    },
  });

  beacon.start();
  await settle();

  expect(JSON.stringify(beacon.running.get())).not.toContain("secret");
});

const createHungBeacon = (journal?: JournalOptions) => {
  const mock = createMockSource<Manifest>({ name: "manifest" });

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "inert",
      open: () => ({ native: {} }),
      commands: {},
    }),
  });

  return createRoutedBeacon(
    { web },
    {
      running: {
        boot: { id: "boot-1" },
        web: () => new Promise<RunningRelease>(() => {}),
      },
      ...(journal === undefined ? {} : { journal }),
    },
  );
};

test("LIFE-01 a check that waits for a reader that never answers ends with the session, not with the reader", async () => {
  const { beacon } = createHungBeacon();

  beacon.start();

  const checking = beacon.route("web").check();

  beacon.stop();

  await expect(checking).resolves.toEqual({ status: "superseded" });
});

test("a caller that aborts while a reader has not answered stops waiting at once", async () => {
  const { beacon } = createHungBeacon();
  const controller = new AbortController();

  beacon.start();

  const checking = beacon.route("web").check({ signal: controller.signal });

  await settle();
  controller.abort();

  await expect(checking).resolves.toEqual({ status: "cancelled" });
});

test("JOURNAL-04 a reader that never answered in an ended session does not hold the journal of the next", async () => {
  const memory = createMemoryStorage();

  const { beacon, clock } = createHungBeacon({
    mode: "best-effort",
    storage: memory.storage,
  });

  beacon.start();
  beacon.stop();
  beacon.start();
  clock.advance(20_000);
  await settle();

  expect(beacon.transitions.get().journal).toBe("ready");
});
