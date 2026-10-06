import { expect, test } from "vitest";

import { createGate } from "src/mock/createGate";
import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { settle } from "src/mock/settle";
import type { RunningRelease } from "src/types/RunningRelease";
import { buildWebRelease, SCOPE } from "src/utils/Beacon.fixture";
import {
  answerWithBuild,
  createWebCommandBeacon,
  takeRun,
} from "src/utils/commands.fixture";

// What a session owns is released when it ends: no timer is left armed, every read it held is abandoned, and every promise a caller was handed settles.

// A Beacon with every moving part busy: a running reader that has not answered, a read under way, a document that expires, a command whose guard is still settling and a journal.
const createBusyBeacon = () => {
  const storage = createMockJournalStorage();
  const reader = createGate();

  const context = createWebCommandBeacon({
    journal: { mode: "required", storage },
    reader: async (): Promise<RunningRelease> => {
      await reader.wait();

      return buildWebRelease("web-build-b");
    },
  });

  return { ...context, storage, reader };
};

test("stopping the session leaves no timer armed and settles every call that was waiting", async () => {
  const context = createBusyBeacon();
  const { beacon, clock, mock } = context;

  context.reader.hold();
  beacon.start();

  // The running reader is waited for under a deadline, and a check waits for it.
  const first = beacon.route("web").check();

  await settle();
  expect(clock.pendingTimers()).toBeGreaterThan(0);
  context.reader.release();
  await settle();

  // A read is under way under its own deadline, and answers.
  answerWithBuild(mock, "web-build-a", "208");
  await first;

  // The document expires on a timer of its own, and a second read is held.
  expect(clock.pendingTimers()).toBeGreaterThan(0);
  mock.hold();

  const second = beacon.route("web").check();

  await settle();
  expect(mock.stats().held).toBe(1);

  // A command whose guard never finishes settling holds a deadline too.
  beacon.disruptions.register({
    name: "drafts",
    reserve: () => ({
      status: "reserved",
      settle: () => new Promise(() => {}),
    }),
  });

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  const reloading = beacon.route("web").reload({ offer: observation.offer });

  await settle();
  expect(beacon.route("web").state.get().operation).toMatchObject({
    state: "running",
  });

  beacon.stop();

  expect(clock.pendingTimers()).toBe(0);
  expect(mock.stats().aborted).toBeGreaterThan(0);
  await expect(second).resolves.toEqual({ status: "superseded" });
  await expect(reloading).resolves.toMatchObject({ status: "cancelled" });
  expect(beacon.route("web").state.get().operation).toEqual({ state: "idle" });
});

test("disposing the Beacon after a restart leaves no timer armed either, and a call made then settles at once", async () => {
  const context = createBusyBeacon();
  const { beacon, clock, mock } = context;

  context.reader.release();
  beacon.start();

  const checking = beacon.route("web").check();

  await settle();
  answerWithBuild(mock, "web-build-a", "208");
  await checking;

  beacon.stop();
  expect(clock.pendingTimers()).toBe(0);

  // A second session arms its own, and ends them all with the Beacon.
  beacon.start();
  mock.hold();

  const pending = beacon.route("web").check();

  await settle();
  expect(clock.pendingTimers()).toBeGreaterThan(0);

  beacon.dispose();

  expect(clock.pendingTimers()).toBe(0);
  await expect(pending).resolves.toEqual({ status: "superseded" });
  await expect(beacon.route("web").check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DISPOSED" },
  });
  expect(clock.pendingTimers()).toBe(0);
});

test("disposing the Beacon while the journal's storage has not answered leaves no deadline armed, and the late answer is counted and changes nothing", async () => {
  const context = createBusyBeacon();
  const { beacon, clock, mock, storage } = context;

  context.reader.release();
  beacon.start();

  const checking = beacon.route("web").check();

  await settle();
  answerWithBuild(mock, "web-build-a", "208");
  await checking;

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  // The intent of a reload is being written, and the storage has not answered.
  storage.holdWrites();

  const reloading = beacon.route("web").reload({ offer: observation.offer });

  await settle();
  expect(clock.pendingTimers()).toBeGreaterThan(0);

  beacon.dispose();

  expect(clock.pendingTimers()).toBe(0);
  await expect(reloading).resolves.toMatchObject({ status: "cancelled" });

  // The storage answers late: nothing is dispatched, and nothing is armed again.
  storage.releaseWrites();
  await settle();
  expect(context.runs).toHaveLength(0);
  expect(clock.pendingTimers()).toBe(0);
});

test("disposing the Beacon while calls wait behind one the journal's storage has not answered arms nothing and asks the storage no more", async () => {
  const context = createBusyBeacon();
  const { beacon, clock, mock, storage } = context;

  context.reader.release();
  beacon.start();

  const checking = beacon.route("web").check();

  await settle();
  answerWithBuild(mock, "web-build-a", "208");
  await checking;

  // Two scopes in a row each read the record of their own: the first read is held, and the second waits behind it.
  storage.holdReads();
  beacon.replaceScope({ ...SCOPE, environment: "canary" });
  beacon.replaceScope({ ...SCOPE, environment: "staging" });
  await settle();

  const asked = storage.reads();

  expect(clock.pendingTimers()).toBeGreaterThan(0);

  beacon.dispose();
  expect(clock.pendingTimers()).toBe(0);

  // The queue moves on when the first call is given up, and what waited behind it is never sent: a Beacon that ended asks nothing and arms nothing.
  await settle();
  expect(storage.reads()).toBe(asked);
  expect(clock.pendingTimers()).toBe(0);
  storage.releaseReads();
  await settle();
  expect(storage.reads()).toBe(asked);
  expect(clock.pendingTimers()).toBe(0);
});

test("a command dispatched to the provider stays indeterminate when the Beacon is disposed, and releases its guard", async () => {
  const context = createBusyBeacon();
  const { beacon, clock, mock } = context;
  const resumed: string[] = [];

  context.reader.release();
  beacon.disruptions.register({
    name: "drafts",
    reserve: () => ({
      status: "reserved",
      resume: () => resumed.push("drafts"),
    }),
  });
  beacon.start();

  const checking = beacon.route("web").check();

  await settle();
  answerWithBuild(mock, "web-build-a", "208");
  await checking;

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  const reloading = beacon.route("web").reload({ offer: observation.offer });

  await settle();
  expect(context.runs).toHaveLength(1);
  beacon.dispose();

  // The provider was asked, so nobody can say it did not take effect: the call ends as the session did, and the guard is given back.
  await expect(reloading).resolves.toMatchObject({ status: "indeterminate" });
  expect(resumed).toEqual(["drafts"]);
  expect(clock.pendingTimers()).toBe(0);

  // The late answer of the provider changes nothing.
  takeRun(context.runs).settleWith({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
  await settle();
  expect(clock.pendingTimers()).toBe(0);
});
