import { afterEach, expect, test, vi } from "vitest";

import { settle } from "src/mock/settle";
import { createBrokenClock } from "src/utils/Beacon.fixture";
import {
  ACCEPTED_RELOAD,
  answerWithBuild,
  createParticipant,
  createWebCommandBeacon,
  startWithOffer,
  takeRun,
} from "src/utils/commands.fixture";

afterEach(() => {
  vi.useRealTimers();
});

test("a clock that cannot arm a timer fails a check and never rejects it, and the next one is asked again", async () => {
  const { clock, state } = createBrokenClock();
  const context = createWebCommandBeacon({ clock });
  const web = context.beacon.route("web");

  context.beacon.start();

  const report = await context.beacon.check();

  expect(report.routes.web).toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });
  expect(web.state.get().check).toMatchObject({
    state: "failed",
    error: { code: "SOURCE_FAILED" },
  });
  expect(context.mock.stats().reads).toBe(0);

  await expect(web.check()).resolves.toMatchObject({ status: "failed" });

  state.broken = false;

  const checking = web.check();

  await settle();
  answerWithBuild(context.mock, "web-build-a", "208");

  await expect(checking).resolves.toMatchObject({ status: "succeeded" });
  expect(web.state.get().check).toMatchObject({ state: "succeeded" });
});

test("a clock that cannot arm a timer does not stop a command that has nobody to settle with", async () => {
  const { clock, state } = createBrokenClock();
  const context = createWebCommandBeacon({ clock });

  state.broken = false;

  const offer = await startWithOffer(context);

  state.broken = true;

  const reloading = context.beacon.route("web").reload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  await expect(reloading).resolves.toMatchObject({ status: "accepted" });
});

test("a clock that cannot arm a timer for a participant's settlement blocks the command by name, releases what was reserved, and reports the failure", async () => {
  vi.useFakeTimers({ toFake: ["queueMicrotask"] });

  const { clock, state } = createBrokenClock();
  const context = createWebCommandBeacon({ clock });
  const log: string[] = [];

  state.broken = false;

  const offer = await startWithOffer(context);

  state.broken = true;
  context.beacon.disruptions.register(createParticipant("drafts", log));

  const web = context.beacon.route("web");

  await expect(web.reload({ offer })).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "settlement-failed", participant: { name: "drafts" } }],
  });
  expect(() => vi.runAllTicks()).toThrow("The clock cannot arm a timer.");
  expect(log).toEqual(["drafts:reserve", "drafts:release"]);
  expect(web.state.get().operation).toMatchObject({ state: "idle" });
  expect(context.runs).toHaveLength(0);

  state.broken = false;

  const reloading = web.reload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  await expect(reloading).resolves.toMatchObject({ status: "accepted" });
});

test("a clock that cannot arm a timer for an expiry leaves the document expired when the session starts again, and start does not throw", async () => {
  const { clock, state } = createBrokenClock();
  const context = createWebCommandBeacon({ clock });

  state.broken = false;
  await startWithOffer(context);
  context.beacon.stop();
  state.broken = true;

  expect(() => context.beacon.start()).not.toThrow();
  expect(context.beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
    evidence: { freshness: "expired" },
  });
});
