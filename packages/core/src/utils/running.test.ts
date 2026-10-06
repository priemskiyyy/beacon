import { expect, test, vi } from "vitest";

import type { JournalOptions } from "src/types/JournalOptions";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningRelease } from "src/types/RunningRelease";
import { createMockSource } from "src/mock/createMockSource";
import { createTestClock } from "src/mock/createTestClock";
import {
  buildWebRelease,
  createBeacon,
  createRoutedBeacon,
  settle,
} from "src/utils/Beacon.fixture";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { createMemoryStorage } from "src/utils/journal.fixture";
import { targetRoute } from "src/utils/targetRoute";
import { createWebBeacon } from "src/utils/routes.fixture";
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

test("the readers are the ones given at construction, whatever the application does to its options after", async () => {
  const first = vi.fn(() => buildWebRelease("web-build-a"));
  const second = vi.fn(() => buildWebRelease("web-build-b"));
  const running = { boot: { id: "boot-1" }, web: first };
  const { beacon } = createBeacon({ running });

  running.web = second;
  beacon.start();
  await settle();

  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
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

test("a reader that answers something that is not a release fails its subject, and is no late callback", async () => {
  const { beacon } = createBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => Promise.resolve(JSON.parse("null")),
      native: () => Promise.resolve(JSON.parse("{}")),
    },
  });

  beacon.start();
  await settle();

  const { web, native } = beacon.running.get();

  expect(web).toEqual({
    state: "failed",
    error: {
      code: "RUNNING_READ_FAILED",
      message: "A running fact could not be read.",
    },
  });
  expect(native.state).toBe("failed");
  expect(beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("a clock that cannot arm a timer fails the fact instead of leaving the read pending", async () => {
  const clock = createTestClock({ now: 1_000 });

  const { beacon } = createBeacon({
    clock: {
      ...clock,
      setTimer: () => {
        throw new Error("No timer can be armed.");
      },
    },
    running: {
      boot: { id: "boot-1" },
      web: () => buildWebRelease("web-build-a"),
    },
  });

  beacon.start();
  await settle();

  expect(beacon.running.get().web).toEqual({
    state: "failed",
    error: {
      code: "RUNNING_READ_FAILED",
      message: "A running fact could not be read.",
    },
  });
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

const known = (value: string) =>
  ({
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value,
  }) satisfies ReleaseIdentity;

const FIRST: RunningRelease = {
  identity: known("a"),
  label: "A",
  raw: { build: 1 },
};

const UNNAMED: RunningRelease = {
  identity: { status: "unknown", reason: "unnamed" },
  label: null,
  raw: {},
};

const REREADS: Array<[string, RunningRelease, RunningRelease, boolean]> = [
  ["nothing different", FIRST, { ...FIRST }, false],
  ["another identity", FIRST, { ...FIRST, identity: known("b") }, true],
  [
    "another domain",
    FIRST,
    { ...FIRST, identity: { ...known("a"), domain: "other" } },
    true,
  ],
  [
    "another authority",
    FIRST,
    { ...FIRST, identity: { ...known("a"), authority: "other" } },
    true,
  ],
  ["another label", FIRST, { ...FIRST, label: null }, true],
  ["another raw value", FIRST, { ...FIRST, raw: { build: 2 } }, true],
  ["another raw key", FIRST, { ...FIRST, raw: { edition: 1 } }, true],
  [
    "an added raw key",
    FIRST,
    { ...FIRST, raw: { build: 1, edition: 1 } },
    true,
  ],
  ["an identity that became unknown", FIRST, UNNAMED, true],
  ["an unknown identity again", UNNAMED, { ...UNNAMED }, false],
  [
    "another reason for the unknown identity",
    UNNAMED,
    { ...UNNAMED, identity: { status: "unknown", reason: "other" } },
    true,
  ],
  ["an identity that became known", UNNAMED, FIRST, true],
];

test("a re-read that differs in what it says is a change, and one that differs in nothing is not", async () => {
  for (const [difference, first, second, changes] of REREADS) {
    const answers = [first, second];

    const { beacon } = createBeacon({
      running: {
        boot: { id: "boot-1" },
        web: () => answers.shift() ?? second,
      },
    });

    beacon.start();
    await settle();

    const { revision } = beacon.running.get();

    beacon.stop();
    beacon.start();
    await settle();

    expect(beacon.running.get().revision !== revision, difference).toBe(
      changes,
    );
  }
});

test("a failed fact whose message changed is a change, so the state says what failed last", async () => {
  const answers = [
    () => Promise.reject(new Error("The native module is gone.")),
    () => new Promise<RunningRelease>(() => {}),
  ];

  const { beacon, clock } = createBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => {
        const answer = answers.shift();

        if (answer === undefined) {
          throw new Error("No answer is left.");
        }

        return answer();
      },
    },
    timeouts: { running: 500 },
  });

  beacon.start();
  await settle();

  expect(beacon.running.get().web).toMatchObject({
    error: { message: "A running fact could not be read." },
  });

  beacon.stop();
  beacon.start();
  clock.advance(500);
  await settle();

  expect(beacon.running.get()).toMatchObject({
    revision: 2,
    web: { error: { message: "A running fact was not read in time." } },
  });
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

test("LIFE-01 however late the session ends, a fact is installed only while it is open, and is counted otherwise", async () => {
  // The stop is queued a number of microtasks after the answer is taken, so it lands between every step of the read.
  for (let depth = 0; depth < 8; depth += 1) {
    const clock = createTestClock({ now: 1_000 });

    let armed = false;

    let stop = () => {};

    const { beacon } = createBeacon({
      clock: {
        ...clock,
        now: () => {
          if (!armed) {
            return clock.now();
          }

          armed = false;

          let queued = () => stop();

          for (let step = 0; step < depth; step += 1) {
            const next = queued;

            queued = () => queueMicrotask(next);
          }

          queueMicrotask(queued);

          return clock.now();
        },
      },
      running: {
        boot: { id: "boot-1" },
        web: () => buildWebRelease("web-build-a"),
      },
    });

    const log: string[] = [];

    stop = () => beacon.stop();
    beacon.running.subscribe(() => log.push("fact"));
    beacon.status.subscribe(() => log.push(beacon.status.get().state));
    armed = true;
    beacon.start();
    await settle();

    const installed = log.includes("fact");

    expect(log.slice(log.indexOf("stopped")), `depth ${depth}`).not.toContain(
      "fact",
    );
    expect(
      beacon.diagnostics.get().counters.lateCallbacks,
      `depth ${depth}`,
    ).toBe(installed ? 0 : 1);
  }
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

// What an application that checks as soon as its session opens does, from the status listener itself.
const checkWhenRunning = (
  beacon: ReturnType<typeof createWebBeacon>["beacon"],
) =>
  beacon.status.subscribe(() => {
    if (beacon.status.get().state !== "running") {
      return;
    }

    beacon.route("web").check();
  });

test("a check that a status listener makes while the session opens waits for that session's running facts", async () => {
  const held = createDeferred<RunningRelease>();

  const { beacon, mock } = createWebBeacon({
    running: { boot: { id: "boot-1" }, web: () => held.promise },
  });

  checkWhenRunning(beacon);
  beacon.start();
  await settle();

  expect(mock.stats().reads).toBe(0);

  held.resolve(buildWebRelease("web-build-b"));
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("a check in a restarted session waits for the running facts of that session, not for those of the last", async () => {
  const held = createDeferred<RunningRelease>();
  const answers = [() => buildWebRelease("web-build-b"), () => held.promise];

  const { beacon, mock } = createWebBeacon({
    running: {
      boot: { id: "boot-1" },
      web: () => {
        const answer = answers.shift();

        if (answer === undefined) {
          throw new Error("No answer is left.");
        }

        return answer();
      },
    },
  });

  beacon.start();
  await settle();
  beacon.stop();
  checkWhenRunning(beacon);
  beacon.start();
  await settle();

  expect(mock.stats().reads).toBe(0);

  held.resolve(buildWebRelease("web-build-b"));
  await settle();

  expect(mock.stats().reads).toBe(1);
});

test("a reader that checks while it is being read is still read once", async () => {
  let checking: Promise<unknown> = Promise.resolve();

  const reader = vi.fn(() => {
    if (reader.mock.calls.length === 1) {
      checking = beacon.check();
    }

    return buildWebRelease("web-build-b");
  });

  const { beacon, mock } = createWebBeacon({
    running: { boot: { id: "boot-1" }, web: reader },
  });

  beacon.start();
  await settle();

  expect(reader).toHaveBeenCalledTimes(1);
  expect(mock.stats().reads).toBe(1);
  mock.reject(new Error("The source is down."));
  await checking;
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
