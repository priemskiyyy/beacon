import { expect, test } from "vitest";

import { SCOPE, settle } from "src/utils/Beacon.fixture";
import {
  ACCEPTED_RELOAD,
  answerWithBuild,
  createParticipant,
  createWebCommandBeacon,
  startWithOffer,
  takeRun,
} from "src/utils/commands.fixture";
import {
  buildIntent,
  buildStored,
  createMemoryStorage,
  KEY,
  seed,
} from "src/utils/journal.fixture";
import { createJournalKey } from "src/utils/internal/journal/createJournalKey";
import { parseJournal } from "src/utils/internal/journal/parseJournal";
import { serializeJournal } from "src/utils/internal/journal/serializeJournal";

type Mode = "best-effort" | "required";

const createJournaled = (
  memory: ReturnType<typeof createMemoryStorage>,
  mode: Mode = "required",
  extra: Parameters<typeof createWebCommandBeacon>[0] = {},
) =>
  createWebCommandBeacon({
    journal: { mode, storage: memory.storage },
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

const readRecord = (memory: ReturnType<typeof createMemoryStorage>) => {
  const text = memory.data.get(KEY);

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
  const memory = createMemoryStorage();
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
  const memory = createMemoryStorage();
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
  expect(memory.data.has(KEY)).toBe(false);
});

test("an intent is written before the provider is asked, and holds identities and nothing else", async () => {
  const memory = createMemoryStorage();
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

test("a command that changes nothing that is running writes no intent", async () => {
  const memory = createMemoryStorage();
  const context = createJournaled(memory);

  context.beacon.start();
  await context.beacon.route("web").prefetch();

  expect(memory.calls.writes).toBe(0);
});

test("JOURNAL-03 an intent written before a crash is read back as an intent, not as proof of a dispatch", async () => {
  const memory = createMemoryStorage();

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
  const memory = createMemoryStorage();

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
  const memory = createMemoryStorage();
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
  const memory = createMemoryStorage();
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

  memory.data.set(
    createJournalKey(staging),
    serializeJournal([buildStored(buildIntent({ boot: { id: "boot-7" } }))]),
  );

  expect(context.beacon.replaceScope(staging)).toEqual({ status: "replaced" });
  memory.releaseReads();
  await settle();
  await settle();

  expect(
    parseJournal(memory.data.get(createJournalKey(staging)) ?? "")?.map(
      ({ intent }) => intent.boot.id,
    ),
  ).toEqual(["boot-7"]);
  expect(context.beacon.transitions.get().latest).toMatchObject({
    intent: { boot: { id: "boot-7" } },
  });
});

test("JOURNAL-06 the same boot resuming is not a new boot and confirms nothing", async () => {
  const memory = createMemoryStorage();

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
  const memory = createMemoryStorage();

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
  const memory = createMemoryStorage();
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
  const memory = createMemoryStorage();

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
  const memory = createMemoryStorage();
  const events: string[] = [];

  memory.data.set(KEY, "{not json");

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
  const memory = createMemoryStorage();

  memory.data.set(KEY, JSON.stringify({ version: 99, transitions: [] }));

  const context = createJournaled(memory);

  context.beacon.start();
  await settle();

  expect(context.beacon.transitions.get().latest).toBeNull();
});

test("JOURNAL-11 boots in a row that leave the same target unreached use up the budget, and a new target starts again", async () => {
  const memory = createMemoryStorage();
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

  const other = createMemoryStorage();

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

test("JOURNAL-12 two contexts share no atomic counter: the last write wins and is what a later boot reads", async () => {
  const memory = createMemoryStorage();
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
  const memory = createMemoryStorage();

  seed(memory, [buildStored(buildIntent())]);

  const context = createJournaled(memory, "required", { boot: "boot-2" });

  context.beacon.start();
  await settle();
  await context.beacon.clearJournal();

  expect(memory.data.has(KEY)).toBe(false);
  expect(context.beacon.transitions.get().latest).toBeNull();
  expect(context.runs).toHaveLength(0);
});

test("JOURNAL-14 the journal keeps a bounded history, and says how much older correlation it let go", async () => {
  const memory = createMemoryStorage();

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
  const memory = createMemoryStorage();

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
  const memory = createMemoryStorage();
  const context = createJournaled(memory);
  const log: string[] = [];
  const offer = await startWithOffer(context);

  context.beacon.disruptions.register(createParticipant("drafts", log));
  await reload(context, offer);

  expect(log).toEqual(["drafts:reserve", "drafts:settle"]);
  expect(memory.calls.writes).toBe(1);
});

test("SAFE-07 an offer replaced while the intent is written stops the command before the provider", async () => {
  const memory = createMemoryStorage();
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
  const memory = createMemoryStorage();
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
  const memory = createMemoryStorage();
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

  memory.data.set(
    createJournalKey(staging),
    serializeJournal([buildStored(buildIntent({ boot: { id: "boot-7" } }))]),
  );

  expect(context.beacon.replaceScope(staging)).toEqual({ status: "replaced" });
  memory.releaseWrites();
  await settle();

  expect(
    parseJournal(memory.data.get(createJournalKey(staging)) ?? "")?.map(
      ({ intent }) => intent.boot.id,
    ),
  ).toEqual(["boot-7"]);
  expect(context.beacon.transitions.get().latest).toMatchObject({
    intent: { boot: { id: "boot-7" } },
  });
});

test("JOURNAL-06 boots in a row are counted, not the intents of one boot", async () => {
  const memory = createMemoryStorage();

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
  const memory = createMemoryStorage();

  for (const journal of [
    { retention: Number.POSITIVE_INFINITY },
    { retention: 0 },
    { budget: 0 },
    { budget: 1.5 },
  ]) {
    expect(() =>
      createWebCommandBeacon({
        journal: { mode: "best-effort", storage: memory.storage, ...journal },
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  }
});

test("JOURNAL-08 a record that could not be read is not replaced by an intent that knows nothing of it", async () => {
  const memory = createMemoryStorage();

  seed(memory, [buildStored(buildIntent({ boot: { id: "boot-0" } }))]);
  memory.failReads(new Error("storage offline"));

  const context = createJournaled(memory, "best-effort", { boot: "boot-2" });
  const offer = await startWithOffer(context);
  const before = memory.data.get(KEY);

  memory.failReads(null);

  await reload(context, offer);

  expect(memory.data.get(KEY)).toBe(before);
  expect(context.beacon.transitions.get().journal).toBe("degraded");
});

test("JOURNAL-09 intents lost to the capacity of a journal that cannot be written are counted", async () => {
  const memory = createMemoryStorage();
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
