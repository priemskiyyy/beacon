import { expect, test } from "vitest";

import type { RunningRelease } from "src/types/RunningRelease";
import { createMockSource } from "src/mock/createMockSource";
import { settle } from "src/mock/settle";
import {
  buildWebRelease,
  createRoutedBeacon,
  SCOPE,
} from "src/utils/Beacon.fixture";
import { buildNativeRelease } from "src/utils/policy.fixture";
import type { Manifest } from "src/utils/routes.fixture";
import { targetRoute } from "src/utils/targetRoute";
import { DEFAULT_RUNNING_TIMEOUT } from "src/utils/constants/defaults";
import {
  ACCEPTED_RELOAD,
  answerWithBuild,
  createHeldMechanism,
  createParticipant,
  createWebCommandBeacon,
  startWithOffer,
  takeRun,
} from "src/utils/commands.fixture";
import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import type { MockJournalStorage } from "src/mock/types/MockJournalStorage";
import { buildIntent, buildStored, KEY, seed } from "src/utils/journal.fixture";
import { createDeferred } from "src/utils/internal/common/createDeferred";
import { createJournalKey } from "src/utils/internal/journal/createJournalKey";
import { parseJournal } from "src/utils/internal/journal/parseJournal";
import { serializeJournal } from "src/utils/internal/journal/serializeJournal";

type Mode = "best-effort" | "required";

const createJournaled = (
  memory: MockJournalStorage,
  mode: Mode = "required",
  extra: Parameters<typeof createWebCommandBeacon>[0] = {},
) =>
  createWebCommandBeacon({
    journal: { mode, storage: memory },
    ...extra,
  });

const reload = async (
  context: ReturnType<typeof createWebCommandBeacon>,
  offer: Awaited<ReturnType<typeof startWithOffer>>,
) => {
  const pending = context.beacon.route("web").reload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  return pending;
};

const readRecord = (memory: MockJournalStorage) => {
  const text = memory.records.get(KEY);

  if (text === undefined) {
    return [];
  }

  return parseJournal(text) ?? [];
};

test("a Beacon without a journal says it is off and writes nothing", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);

  await reload(context, offer);

  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "off",
    latest: null,
  });
});

test("JOURNAL-01 a required intent that cannot be written stops the command before the provider", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory);
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  memory.failWrites(new Error("quota exceeded"));

  await expect(web.reload({ offer })).resolves.toMatchObject({
    status: "failed",
    error: { code: "JOURNAL_FAILED" },
  });
  expect(context.runs).toHaveLength(0);
  expect(web.state.get().operation).toEqual({ state: "idle" });
  expect(context.beacon.transitions.get().journal).toBe("degraded");
});

test("JOURNAL-02 a best-effort intent that cannot be written is visible, and the command goes on", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory, "best-effort");
  const offer = await startWithOffer(context);
  const events: string[] = [];

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(event.type);
  });
  memory.failWrites(new Error("quota exceeded"));

  await expect(reload(context, offer)).resolves.toMatchObject({
    status: "accepted",
  });
  expect(events).toContain("journal-failed");
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "degraded",
    latest: { outcome: "same-boot", intent: { command: "reload" } },
  });
  expect(memory.records.has(KEY)).toBe(false);
});

test("JOURNAL-02 a best-effort intent that cannot be written is announced once, in the state that says the journal degraded", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory, "best-effort");
  const offer = await startWithOffer(context);
  const heard: Array<ReturnType<typeof context.beacon.transitions.get>> = [];

  context.beacon.transitions.subscribe(() => {
    heard.push(context.beacon.transitions.get());
  });
  memory.failWrites(new Error("quota exceeded"));
  await reload(context, offer);

  expect(heard).toHaveLength(1);
  expect(heard[0]).toMatchObject({
    journal: "degraded",
    latest: { intent: { command: "reload" } },
  });
});

test("an intent is written before the provider is asked, and holds identities and nothing else", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory);
  const offer = await startWithOffer(context);
  const pending = context.beacon.route("web").reload({ offer });

  await settle();

  expect(context.runs).toHaveLength(1);
  expect(readRecord(memory)).toEqual([
    {
      intent: {
        operation: { id: 1 },
        boot: { id: "boot-1" },
        route: "web",
        command: "reload",
        subject: "web",
        current: {
          status: "known",
          authority: "com.example.notes",
          domain: "web-artifact",
          value: "web-build-b",
        },
        target: {
          status: "known",
          authority: "com.example.notes",
          domain: "web-artifact",
          value: "web-build-a",
        },
        binding: "unpinned-navigation",
        createdAt: 1_000,
        expiresAt: 86_401_000,
      },
      outcome: null,
      attempts: 0,
    },
  ]);

  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await pending;
});

test("an intent names what ran as it was known: an unnamed build as unknown, and a build not read as nothing", async () => {
  const unnamed = createMockJournalStorage();
  const first = createJournaled(unnamed, "required", { build: null });

  first.beacon.start();
  await first.beacon.route("web").refresh();

  expect(readRecord(unnamed)[0]?.intent).toMatchObject({
    current: { status: "unknown", reason: "unnamed-build" },
    target: null,
  });

  const unread = createMockJournalStorage();
  const second = createJournaled(unread, "required", { failRead: true });

  second.beacon.start();
  await second.beacon.route("web").refresh();

  expect(readRecord(unread)[0]?.intent).toMatchObject({
    current: null,
    target: null,
  });
});

test("an intent names the subject of the route's mechanism, and the build that subject runs", async () => {
  const memory = createMockJournalStorage();
  const held = createHeldMechanism({ subject: "native" });
  const mock = createMockSource<Manifest>({ name: "manifest" });

  const web = targetRoute({
    source: mock.source.select((manifest) => manifest.web),
    mechanism: held.mechanism,
  });

  const { beacon } = createRoutedBeacon(
    { web },
    {
      running: {
        boot: { id: "boot-1" },
        web: () => buildWebRelease("web-build-b"),
        native: () => buildNativeRelease(100),
      },
      journal: { mode: "required", storage: memory },
    },
  );

  beacon.start();
  await beacon.route("web").refresh();

  expect(readRecord(memory)[0]?.intent).toMatchObject({
    subject: "native",
    current: { status: "known", domain: "android-version-code", value: "100" },
  });
});

test("an intent names what the reader answered when it answers a macrotask after a command issued in the turn of start", async () => {
  const memory = createMockJournalStorage();
  const held = createDeferred<RunningRelease>();

  const context = createJournaled(memory, "required", {
    reader: () => held.promise,
  });

  context.beacon.start();

  const refreshing = context.beacon.route("web").refresh();

  await settle();

  // The command waits for the reader, and nothing is written about a build nobody has named yet.
  expect(memory.writes()).toBe(0);
  expect(context.beacon.route("web").state.get().operation).toMatchObject({
    state: "running",
  });

  held.resolve(buildWebRelease("web-build-b"));
  await refreshing;

  expect(readRecord(memory)[0]?.intent).toMatchObject({
    current: { status: "known", value: "web-build-b" },
  });
});

test("a command that waits for the reader waits no longer than the running timeout, and the intent then names nothing as running", async () => {
  const memory = createMockJournalStorage();

  const context = createJournaled(memory, "required", {
    reader: () => new Promise(() => {}),
  });

  context.beacon.start();

  const refreshing = context.beacon.route("web").refresh();

  await settle();
  expect(memory.writes()).toBe(0);

  context.clock.advance(DEFAULT_RUNNING_TIMEOUT);
  await refreshing;

  expect(readRecord(memory)[0]?.intent).toMatchObject({ current: null });
});

test("a caller that stops waiting while the command waits for the reader cancels it before anything is written or dispatched", async () => {
  const memory = createMockJournalStorage();
  const controller = new AbortController();

  const context = createJournaled(memory, "required", {
    reader: () => new Promise(() => {}),
  });

  context.beacon.start();

  const refreshing = context.beacon
    .route("web")
    .refresh({ signal: controller.signal });

  await settle();
  controller.abort();

  await expect(refreshing).resolves.toEqual({
    status: "cancelled",
    stage: "journaling",
  });
  expect(memory.writes()).toBe(0);
  expect(context.beacon.route("web").state.get().operation).toMatchObject({
    state: "idle",
  });
});

test("a session that ends while the command waits for the reader cancels it, and the next session can command again", async () => {
  const memory = createMockJournalStorage();

  const context = createJournaled(memory, "required", {
    reader: () => new Promise(() => {}),
  });

  context.beacon.start();

  const refreshing = context.beacon.route("web").refresh();

  await settle();
  context.beacon.stop();

  await expect(refreshing).resolves.toEqual({
    status: "cancelled",
    stage: "journaling",
  });
  expect(memory.writes()).toBe(0);
  expect(context.beacon.route("web").state.get().operation).toMatchObject({
    state: "idle",
  });
});

test("a command without a journal does not wait for a reader that has not answered", async () => {
  const context = createWebCommandBeacon({
    reader: () => new Promise(() => {}),
  });

  context.beacon.start();

  await expect(context.beacon.route("web").refresh()).resolves.toMatchObject({
    status: "accepted",
  });
});

test("a command that changes nothing that is running writes no intent", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory);

  context.beacon.start();
  await context.beacon.route("web").prefetch();

  expect(memory.writes()).toBe(0);
});

test("what the journal publishes about an intent cannot be changed, whether the intent was written by this boot or read from an earlier one", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent({ boot: { id: "boot-0" } }))]);

  const written = createJournaled(memory, "required", { boot: "boot-2" });
  const offer = await startWithOffer(written);

  await reload(written, offer);

  const { latest } = written.beacon.transitions.get();

  expect(latest?.intent.boot.id).toBe("boot-2");

  const read = createJournaled(memory, "required", { boot: "boot-3" });

  read.beacon.start();
  await settle();

  for (const published of [latest, read.beacon.transitions.get().latest]) {
    expect(published).not.toBeNull();
    expect(Object.isFrozen(published)).toBe(true);
    expect(Object.isFrozen(published?.intent)).toBe(true);
    expect(Object.isFrozen(published?.intent.operation)).toBe(true);
    expect(Object.isFrozen(published?.intent.boot)).toBe(true);
    expect(Object.isFrozen(published?.intent.current)).toBe(true);
    expect(Object.isFrozen(published?.intent.target)).toBe(true);
  }
});

test("JOURNAL-03 an intent written before a crash is read back as an intent, not as proof of a dispatch", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent())]);

  const next = createJournaled(memory, "required", { boot: "boot-2" });

  next.beacon.start();
  await settle();

  expect(next.beacon.transitions.get().latest).toMatchObject({
    outcome: "target-not-running",
    intent: { command: "reload", boot: { id: "boot-1" } },
  });
  expect(next.runs).toHaveLength(0);
});

test("JOURNAL-04 a next boot that runs the comparable target has reached it, and nothing more is claimed", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent())]);

  const next = createJournaled(memory, "required", {
    boot: "boot-2",
    build: "web-build-a",
  });

  next.beacon.start();
  await settle();

  expect(next.beacon.transitions.get().latest).toMatchObject({
    outcome: "target-running",
    attempts: 0,
    exhausted: false,
  });
});

test("WEB-04 a reload after which the same build is served is read back as not reached, and counted", async () => {
  const memory = createMockJournalStorage();
  const first = createJournaled(memory);
  const offer = await startWithOffer(first);

  await reload(first, offer);

  const next = createJournaled(memory, "required", {
    boot: "boot-2",
    build: "web-build-b",
  });

  next.beacon.start();
  await settle();

  expect(next.beacon.transitions.get().latest).toMatchObject({
    outcome: "target-not-running",
    attempts: 1,
    exhausted: false,
  });
});

test("JOURNAL-05 an intent still queued when the scope is replaced is never written under the next scope's key", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory, "best-effort");
  const controller = new AbortController();
  const staging = { ...SCOPE, environment: "staging" };

  // The record is still being read when the command asks for its intent to be written.
  memory.holdReads();

  const offer = await startWithOffer(context);

  const pending = context.beacon
    .route("web")
    .reload({ offer, signal: controller.signal });

  await settle();
  controller.abort();
  await expect(pending).resolves.toMatchObject({ status: "cancelled" });

  memory.records.set(
    createJournalKey(staging),
    serializeJournal([buildStored(buildIntent({ boot: { id: "boot-7" } }))]),
  );

  expect(context.beacon.replaceScope(staging)).toEqual({ status: "replaced" });
  memory.releaseReads();
  await settle();
  await settle();

  expect(
    parseJournal(memory.records.get(createJournalKey(staging)) ?? "")?.map(
      ({ intent }) => intent.boot.id,
    ),
  ).toEqual(["boot-7"]);
  expect(context.beacon.transitions.get().latest).toMatchObject({
    intent: { boot: { id: "boot-7" } },
  });
});

test("JOURNAL-06 the same boot resuming is not a new boot and confirms nothing", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent())]);

  const same = createJournaled(memory, "required", { boot: "boot-1" });

  same.beacon.start();
  await settle();

  expect(same.beacon.transitions.get().latest).toMatchObject({
    outcome: "same-boot",
  });
  expect(readRecord(memory)[0]?.outcome).toBeNull();
});

test("JOURNAL-07 a target that runs without a reported checkpoint has unknown readiness, and reporting one is idempotent", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent())]);

  const next = createJournaled(memory, "required", {
    boot: "boot-2",
    build: "web-build-a",
  });

  next.beacon.start();
  await settle();

  expect(next.beacon.transitions.get().checkpoints).toEqual([]);
  expect(next.beacon.reportReady({ checkpoint: "primary-screen" })).toEqual({
    status: "recorded",
    checkpoint: "primary-screen",
  });
  expect(next.beacon.reportReady({ checkpoint: "primary-screen" })).toEqual({
    status: "already-recorded",
    checkpoint: "primary-screen",
  });
  expect(next.beacon.transitions.get().checkpoints).toEqual(["primary-screen"]);
});

test("JOURNAL-08 a storage that acknowledged a write it then failed to flush is a failed write", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory);
  const offer = await startWithOffer(context);

  memory.failWrites(new Error("flush failed after an optimistic set"));

  await expect(
    context.beacon.route("web").reload({ offer }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "JOURNAL_FAILED" },
  });
  expect(context.runs).toHaveLength(0);
});

test("JOURNAL-09 a hydration that finishes late does not overwrite an intent written after it began", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [
    buildStored(
      buildIntent({ boot: { id: "boot-0" } }),
      "target-not-running",
      1,
    ),
  ]);
  memory.holdReads();

  const context = createJournaled(memory, "required", { boot: "boot-2" });
  const offer = await startWithOffer(context);
  const pending = context.beacon.route("web").reload({ offer });

  await settle();
  expect(context.runs).toHaveLength(0);

  memory.releaseReads();
  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await pending;

  expect(readRecord(memory).map(({ intent }) => intent.boot.id)).toEqual([
    "boot-0",
    "boot-2",
  ]);
});

test("JOURNAL-10 a corrupt record is ignored with a diagnostic, and never executed", async () => {
  const memory = createMockJournalStorage();
  const events: string[] = [];

  memory.records.set(KEY, "{not json");

  const context = createJournaled(memory);

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(event.type);
  });
  context.beacon.start();
  await settle();

  expect(events).toContain("journal-ignored");
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "ready",
    latest: null,
  });
  expect(context.runs).toHaveLength(0);
});

test("JOURNAL-10 a record of a future schema is ignored, not read as a version it is not", async () => {
  const memory = createMockJournalStorage();

  memory.records.set(KEY, JSON.stringify({ version: 99, transitions: [] }));

  const context = createJournaled(memory);

  context.beacon.start();
  await settle();

  expect(context.beacon.transitions.get().latest).toBeNull();
});

test("a storage that answers nothing at all for a missing key has no record, as one that answers null", async () => {
  const store: Record<string, string> = {};

  const context = createWebCommandBeacon({
    journal: {
      mode: "required",
      storage: {
        // Many stores say `undefined` for a key they do not have, and the answer is not checked by the types of a host that has none.
        read: async (key) => Reflect.get(store, key),
        write: async (key, value) => {
          store[key] = value;
        },
        remove: async (key) => {
          delete store[key];
        },
      },
    },
  });

  context.beacon.start();
  await settle();

  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "ready",
    latest: null,
  });
});

test("JOURNAL-11 boots in a row that leave the same target unreached use up the budget, and a new target starts again", async () => {
  const memory = createMockJournalStorage();
  const target = buildIntent().target;

  seed(memory, [
    buildStored(
      buildIntent({ boot: { id: "boot-a" } }),
      "target-not-running",
      1,
    ),
    buildStored(
      buildIntent({ boot: { id: "boot-b" } }),
      "target-not-running",
      2,
    ),
    buildStored(buildIntent({ boot: { id: "boot-c" } })),
  ]);

  const next = createJournaled(memory, "required", { boot: "boot-d" });

  next.beacon.start();
  await settle();

  expect(next.beacon.transitions.get().latest).toMatchObject({
    outcome: "target-not-running",
    attempts: 3,
    exhausted: true,
  });

  const other = createMockJournalStorage();

  seed(other, [
    buildStored(
      buildIntent({ boot: { id: "boot-a" } }),
      "target-not-running",
      1,
    ),
    buildStored(
      buildIntent({
        boot: { id: "boot-b" },
        target:
          target === null || target.status === "unknown"
            ? target
            : { ...target, value: "web-build-n" },
      }),
    ),
  ]);

  const fresh = createJournaled(other, "required", { boot: "boot-d" });

  fresh.beacon.start();
  await settle();

  expect(fresh.beacon.transitions.get().latest).toMatchObject({
    attempts: 1,
    exhausted: false,
  });
});

test("a scope with text that is not well formed in it starts, and its record is read", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory);

  context.beacon.replaceScope({ ...SCOPE, partition: "user-\uD800" });

  expect(() => context.beacon.start()).not.toThrow();
  await settle();

  expect(memory.reads()).toBe(1);
  expect(context.beacon.transitions.get().journal).toBe("ready");
});

test("JOURNAL-12 two contexts share no atomic counter: the last write wins and is what a later boot reads", async () => {
  const memory = createMockJournalStorage();
  const first = createJournaled(memory, "required", { boot: "boot-a" });
  const second = createJournaled(memory, "required", { boot: "boot-b" });
  const firstOffer = await startWithOffer(first);
  const secondOffer = await startWithOffer(second);

  await reload(first, firstOffer);
  await reload(second, secondOffer);

  expect(readRecord(memory).map(({ intent }) => intent.boot.id)).toEqual([
    "boot-b",
  ]);
});

test("JOURNAL-13 a privacy flow clears the record, and nothing stored is replayed", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent())]);

  const context = createJournaled(memory, "required", { boot: "boot-2" });

  context.beacon.start();
  await settle();
  await context.beacon.clearJournal();

  expect(memory.records.has(KEY)).toBe(false);
  expect(context.beacon.transitions.get().latest).toBeNull();
  expect(context.runs).toHaveLength(0);
});

test("JOURNAL-13 a privacy flow can still clear the record after the Beacon was disposed, and the last snapshot stays", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent())]);

  const context = createJournaled(memory, "required", { boot: "boot-2" });

  context.beacon.start();
  await settle();
  context.beacon.dispose();

  const held = context.beacon.transitions.get();

  await context.beacon.clearJournal();

  expect(memory.records.has(KEY)).toBe(false);
  expect(context.beacon.transitions.get()).toBe(held);
  expect(held.latest).not.toBeNull();
});

test("JOURNAL-13 clearing a Beacon that has no journal has nothing to remove", async () => {
  const context = createWebCommandBeacon();

  context.beacon.start();
  await context.beacon.clearJournal();

  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "off",
    latest: null,
  });
});

test("JOURNAL-13 a record that cannot be removed leaves the journal degraded, with what it held forgotten", async () => {
  const memory = createMockJournalStorage();
  const events: string[] = [];

  seed(memory, [buildStored(buildIntent())]);

  const context = createJournaled(memory, "required", { boot: "boot-2" });

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.reason}`);
  });
  context.beacon.start();
  await settle();

  memory.remove = async () => {
    throw new Error("storage offline");
  };

  await expect(context.beacon.clearJournal()).resolves.toBeUndefined();

  expect(events).toContain("journal-failed:clear");
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "degraded",
    latest: null,
  });
});

test("JOURNAL-13 clearing the record recovers a journal whose first read failed: it is ready, and a command writes", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent({ boot: { id: "boot-0" } }))]);
  memory.failReads(new Error("storage offline"));

  const context = createJournaled(memory, "required", { boot: "boot-2" });
  const offer = await startWithOffer(context);

  expect(context.beacon.transitions.get().journal).toBe("degraded");

  memory.failReads(null);

  await context.beacon.clearJournal();

  expect(memory.records.has(KEY)).toBe(false);
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "ready",
    latest: null,
  });

  await expect(reload(context, offer)).resolves.toMatchObject({
    status: "accepted",
  });
  expect(readRecord(memory).map(({ intent }) => intent.boot.id)).toEqual([
    "boot-2",
  ]);
  expect(context.beacon.transitions.get().journal).toBe("ready");
});

test("JOURNAL-13 a record that cannot be removed does not recover a journal whose first read failed", async () => {
  const memory = createMockJournalStorage();

  memory.failReads(new Error("storage offline"));

  const context = createJournaled(memory, "required", { boot: "boot-2" });
  const offer = await startWithOffer(context);

  memory.failReads(null);

  memory.remove = async () => {
    throw new Error("storage offline");
  };

  await context.beacon.clearJournal();

  expect(context.beacon.transitions.get().journal).toBe("degraded");
  await expect(
    context.beacon.route("web").reload({ offer }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "JOURNAL_FAILED" },
  });
  expect(context.runs).toHaveLength(0);
});

test("JOURNAL-13 a record cleared for the scope that ended recovers nothing for the next one", async () => {
  const memory = createMockJournalStorage();
  const hold = createDeferred<void>();

  memory.failReads(new Error("storage offline"));

  const context = createJournaled(memory, "required", { boot: "boot-2" });

  await startWithOffer(context);
  memory.failReads(null);
  memory.remove = () => hold.promise;

  const clearing = context.beacon.clearJournal();

  await settle();
  context.beacon.replaceScope({ ...SCOPE, environment: "staging" });
  hold.resolve();
  await clearing;

  // The next scope's record was never read, and what cleared another scope's says nothing about it.
  expect(context.beacon.transitions.get().journal).toBe("reading");
});

test("JOURNAL-04 a judged record that cannot be written back is still read, and the journal says degraded", async () => {
  const memory = createMockJournalStorage();
  const events: string[] = [];

  seed(memory, [buildStored(buildIntent())]);
  memory.failWrites(new Error("quota exceeded"));

  const context = createJournaled(memory, "required", { boot: "boot-2" });

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.reason}`);
  });
  context.beacon.start();
  await settle();

  expect(events).toContain("journal-failed:write");
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "degraded",
    latest: { outcome: "target-not-running", attempts: 1 },
  });
});

test("JOURNAL-14 the journal keeps a bounded history, and says how much older correlation it let go", async () => {
  const memory = createMockJournalStorage();

  seed(
    memory,
    Array.from({ length: 8 }, (_, index) =>
      buildStored(
        buildIntent({
          boot: { id: `boot-${index}` },
          operation: { id: index },
        }),
        "target-not-running",
        1,
      ),
    ),
  );

  const context = createJournaled(memory, "required", { boot: "boot-9" });
  const offer = await startWithOffer(context);

  await reload(context, offer);

  expect(readRecord(memory)).toHaveLength(8);
  expect(context.beacon.transitions.get().dropped).toBe(1);
});

test("JOURNAL-14 an intent past its retention is dropped when the record is read, and counted", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent({ expiresAt: 500 }))]);

  const context = createJournaled(memory, "required", { boot: "boot-2" });

  context.beacon.start();
  await settle();

  expect(context.beacon.transitions.get()).toMatchObject({
    latest: null,
    dropped: 1,
  });
});

test("a participant is still settled before the intent is written", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory);
  const log: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register(createParticipant("drafts", log));
  await reload(context, offer);

  expect(log).toEqual(["drafts:reserve", "drafts:settle"]);
  expect(memory.writes()).toBe(1);
});

test("SAFE-07 an offer replaced while the intent is written stops the command before the provider", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory);
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  memory.holdWrites();

  const pending = web.reload({ offer });

  await settle();

  const rechecking = web.check();

  await settle();
  answerWithBuild(context.mock, "web-build-c", "209");
  await rechecking;
  memory.releaseWrites();

  await expect(pending).resolves.toEqual({
    status: "stale",
    reason: "replaced",
  });
  expect(context.runs).toHaveLength(0);
});

test("a caller that aborts while the intent is written cancels, and asks no provider", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory);
  const offer = await startWithOffer(context);
  const controller = new AbortController();

  memory.holdWrites();

  const pending = context.beacon
    .route("web")
    .reload({ offer, signal: controller.signal });

  await settle();
  controller.abort();

  await expect(pending).resolves.toEqual({
    status: "cancelled",
    stage: "journaling",
  });
  expect(context.runs).toHaveLength(0);

  memory.releaseWrites();
});

test("JOURNAL-05 an intent still queued when the scope is replaced is never written under the next scope's key", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory, "best-effort");
  const offer = await startWithOffer(context);
  const controller = new AbortController();
  const staging = { ...SCOPE, environment: "staging" };

  memory.holdWrites();

  const pending = context.beacon
    .route("web")
    .reload({ offer, signal: controller.signal });

  await settle();
  controller.abort();
  await expect(pending).resolves.toMatchObject({ status: "cancelled" });

  memory.records.set(
    createJournalKey(staging),
    serializeJournal([buildStored(buildIntent({ boot: { id: "boot-7" } }))]),
  );

  expect(context.beacon.replaceScope(staging)).toEqual({ status: "replaced" });
  memory.releaseWrites();
  await settle();

  expect(
    parseJournal(memory.records.get(createJournalKey(staging)) ?? "")?.map(
      ({ intent }) => intent.boot.id,
    ),
  ).toEqual(["boot-7"]);
  expect(context.beacon.transitions.get().latest).toMatchObject({
    intent: { boot: { id: "boot-7" } },
  });
});

test("JOURNAL-06 boots in a row are counted, not the intents of one boot", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [
    buildStored(buildIntent({ boot: { id: "boot-0" }, operation: { id: 1 } })),
    buildStored(buildIntent({ boot: { id: "boot-0" }, operation: { id: 2 } })),
    buildStored(buildIntent({ boot: { id: "boot-0" }, operation: { id: 3 } })),
  ]);

  const context = createJournaled(memory, "best-effort", { boot: "boot-1" });

  context.beacon.start();
  await settle();

  expect(context.beacon.transitions.get().latest).toMatchObject({
    outcome: "target-not-running",
    attempts: 1,
    exhausted: false,
  });
});

test("JOURNAL-07 a retention or budget that cannot work is refused when the Beacon is made", () => {
  const memory = createMockJournalStorage();

  for (const journal of [
    { retention: Number.POSITIVE_INFINITY },
    { retention: 0 },
    { budget: 0 },
    { budget: 1.5 },
  ]) {
    expect(() =>
      createWebCommandBeacon({
        journal: { mode: "best-effort", storage: memory, ...journal },
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  }
});

test("JOURNAL-08 a record that could not be read is not replaced by an intent that knows nothing of it", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent({ boot: { id: "boot-0" } }))]);
  memory.failReads(new Error("storage offline"));

  const context = createJournaled(memory, "best-effort", { boot: "boot-2" });
  const offer = await startWithOffer(context);
  const before = memory.records.get(KEY);

  memory.failReads(null);

  await reload(context, offer);

  expect(memory.records.get(KEY)).toBe(before);
  expect(context.beacon.transitions.get().journal).toBe("degraded");
});

test("JOURNAL-09 intents lost to the capacity of a journal that cannot be written are counted", async () => {
  const memory = createMockJournalStorage();
  const context = createJournaled(memory, "best-effort");
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  memory.failWrites(new Error("quota exceeded"));

  for (let index = 0; index < 9; index += 1) {
    await reload(context, offer);
    web.acknowledge();
  }

  expect(context.beacon.transitions.get().dropped).toBe(1);
});

const JOURNAL_TIMEOUT = 500;

const createBounded = (
  memory: MockJournalStorage,
  mode: Mode,
  extra: Parameters<typeof createWebCommandBeacon>[0] = {},
) =>
  createJournaled(memory, mode, {
    timeouts: { journal: JOURNAL_TIMEOUT },
    ...extra,
  });

const listenToJournal = (
  context: ReturnType<typeof createWebCommandBeacon>,
) => {
  const events: string[] = [];

  context.beacon.diagnostics.events.subscribe((event) => {
    events.push(`${event.type}:${event.reason}`);
  });

  return events;
};

const countLate = (context: ReturnType<typeof createWebCommandBeacon>) =>
  context.beacon.diagnostics.get().counters.lateCallbacks;

test("JOURNAL-08 a read that never answers is a failed read at its deadline, and a command waiting behind it goes on", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent({ boot: { id: "boot-0" } }))]);
  memory.holdReads();

  const context = createBounded(memory, "best-effort", { boot: "boot-2" });
  const events = listenToJournal(context);
  const offer = await startWithOffer(context);
  const pending = context.beacon.route("web").reload({ offer });

  await settle();
  context.clock.advance(JOURNAL_TIMEOUT - 1);
  await settle();

  expect(context.runs).toHaveLength(0);
  expect(context.beacon.transitions.get().journal).toBe("reading");

  context.clock.advance(1);
  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  await expect(pending).resolves.toMatchObject({ status: "accepted" });
  expect(events).toContain("journal-failed:read");
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "degraded",
    latest: { intent: { command: "reload" }, outcome: "same-boot" },
  });
});

test("JOURNAL-08 a late answer of a read that timed out is counted and changes nothing", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent({ boot: { id: "boot-0" } }))]);
  memory.holdReads();

  const context = createBounded(memory, "best-effort", { boot: "boot-2" });
  const events = listenToJournal(context);

  context.beacon.start();
  await settle();
  context.clock.advance(JOURNAL_TIMEOUT);
  await settle();

  const before = context.beacon.transitions.get();

  expect(before).toMatchObject({ journal: "degraded", latest: null });
  expect(countLate(context)).toBe(0);

  memory.releaseReads();
  await settle();

  expect(context.beacon.transitions.get()).toBe(before);
  expect(countLate(context)).toBe(1);
  expect(events).toContain("late-callback:journal-read");
});

test("JOURNAL-01 a required intent whose write never answers fails the command at the deadline, before the provider", async () => {
  const memory = createMockJournalStorage();
  const context = createBounded(memory, "required");
  const events = listenToJournal(context);
  const offer = await startWithOffer(context);

  await settle();
  memory.holdWrites();

  const pending = context.beacon.route("web").reload({ offer });

  await settle();
  context.clock.advance(JOURNAL_TIMEOUT - 1);
  await settle();
  expect(context.beacon.route("web").state.get().operation).not.toEqual({
    state: "idle",
  });

  context.clock.advance(1);

  await expect(pending).resolves.toMatchObject({
    status: "failed",
    error: { code: "JOURNAL_FAILED" },
  });
  expect(context.runs).toHaveLength(0);
  expect(events).toContain("journal-failed:write");
  expect(context.beacon.route("web").state.get().operation).toEqual({
    state: "idle",
  });
  expect(context.beacon.transitions.get().journal).toBe("degraded");
});

test("JOURNAL-02 a best-effort intent whose write never answers is degraded at the deadline, and the command goes on", async () => {
  const memory = createMockJournalStorage();
  const context = createBounded(memory, "best-effort");
  const events = listenToJournal(context);
  const offer = await startWithOffer(context);

  await settle();
  memory.holdWrites();

  const pending = context.beacon.route("web").reload({ offer });

  await settle();
  expect(context.runs).toHaveLength(0);

  context.clock.advance(JOURNAL_TIMEOUT);
  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);

  await expect(pending).resolves.toMatchObject({ status: "accepted" });
  expect(events).toContain("journal-failed:write");
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "degraded",
    latest: { outcome: "same-boot", intent: { command: "reload" } },
  });
});

test("an abandoned write does not block the queue, and its late answer is counted and changes nothing", async () => {
  const memory = createMockJournalStorage();
  const context = createBounded(memory, "best-effort");
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  await settle();
  memory.holdWrites();

  const first = web.reload({ offer });

  await settle();
  context.clock.advance(JOURNAL_TIMEOUT);
  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await first;
  web.acknowledge();

  const before = context.beacon.transitions.get();

  memory.releaseWrites();
  await settle();

  expect(countLate(context)).toBe(1);
  expect(context.beacon.transitions.get()).toBe(before);

  const second = web.reload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await second;

  expect(readRecord(memory).map(({ intent }) => intent.operation.id)).toEqual([
    1, 2,
  ]);
});

test("JOURNAL-04 a judged record whose write-back never answers is still read, and the journal says degraded", async () => {
  const memory = createMockJournalStorage();

  seed(memory, [buildStored(buildIntent())]);
  memory.holdWrites();

  const context = createBounded(memory, "required", { boot: "boot-2" });
  const events = listenToJournal(context);

  context.beacon.start();
  await settle();
  expect(context.beacon.transitions.get().journal).toBe("ready");

  context.clock.advance(JOURNAL_TIMEOUT);
  await settle();

  expect(events).toContain("journal-failed:write");
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "degraded",
    latest: { outcome: "target-not-running", attempts: 1 },
  });
});

test("JOURNAL-13 a record whose removal never answers leaves the journal degraded at the deadline, with what it held forgotten", async () => {
  const memory = createMockJournalStorage();
  const hold = createDeferred<void>();

  seed(memory, [buildStored(buildIntent())]);

  const context = createBounded(memory, "required", { boot: "boot-2" });
  const events = listenToJournal(context);

  context.beacon.start();
  await settle();
  memory.remove = () => hold.promise;

  const clearing = context.beacon.clearJournal();

  await settle();
  context.clock.advance(JOURNAL_TIMEOUT);

  await expect(clearing).resolves.toBeUndefined();
  expect(events).toContain("journal-failed:clear");
  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "degraded",
    latest: null,
  });

  hold.resolve();
  await settle();

  expect(countLate(context)).toBe(1);
});

test("a storage call that answers within its deadline leaves no timer and no late callback behind", async () => {
  const memory = createMockJournalStorage();
  const context = createBounded(memory, "required");
  const offer = await startWithOffer(context);

  await settle();

  const armed = context.clock.pendingTimers();

  await reload(context, offer);
  context.clock.advance(JOURNAL_TIMEOUT);
  await settle();

  expect(context.clock.pendingTimers()).toBe(armed);
  expect(readRecord(memory)).toHaveLength(1);
  expect(context.beacon.transitions.get().journal).toBe("ready");
  expect(countLate(context)).toBe(0);
});

test("a storage call gets its deadline from timeouts.journal, 10,000 milliseconds by default", async () => {
  const memory = createMockJournalStorage();

  memory.holdReads();

  const context = createJournaled(memory, "best-effort");

  context.beacon.start();
  await settle();
  context.clock.advance(9_999);
  await settle();
  expect(context.beacon.transitions.get().journal).toBe("reading");

  context.clock.advance(1);
  await settle();
  expect(context.beacon.transitions.get().journal).toBe("degraded");
});

test("JOURNAL-07 a journal timeout that cannot work is refused when the Beacon is made", () => {
  const memory = createMockJournalStorage();

  for (const journal of [Number.POSITIVE_INFINITY, Number.NaN, 0, -1, 1.5]) {
    expect(() =>
      createWebCommandBeacon({
        journal: { mode: "best-effort", storage: memory },
        timeouts: { journal },
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  }

  expect(() => createWebCommandBeacon({ timeouts: { journal: 0 } })).toThrow(
    expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
  );
});
