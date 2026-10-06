import { Beacon, supportPolicy, targetRoute } from "@priemskiyyy/beacon";
import {
  createMockJournalStorage,
  createMockSource,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import type {
  DecisionRevision,
  DisruptionParticipant,
  RunningApplication,
  SupportVerdict,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { browserReload } from "src/browserReload";
import { fakeWindow, SCOPE } from "src/fakeWindow.fixture";
import { webBuild } from "src/webBuild";

// The stories play the specification's end-to-end cases with the public API of the core and this package alone: a manifest document, a support policy, a guard, a journal and a window that counts what is asked of it.

type Manifest = {
  web: TargetDecision;
  support: { deniedReleaseIds: string[] };
};

const REVISION: DecisionRevision = {
  kind: "ordered",
  domain: "notes-web-deployments",
  epoch: "production-v1",
  value: "208",
};

const manifest = (target: string, denied: string[]): Manifest => ({
  web: {
    kind: "target",
    release: {
      identity: {
        status: "known",
        authority: SCOPE.application,
        domain: "web-artifact",
        value: target,
      },
      label: `Build ${target}`,
    },
  },
  support: { deniedReleaseIds: denied },
});

const evaluate = (
  { deniedReleaseIds }: Manifest["support"],
  { web }: RunningApplication,
): SupportVerdict<"web"> => {
  if (web.state !== "known") {
    return { status: "unknown", reasons: [], remediation: [] };
  }

  const { identity } = web.release;

  if (
    identity.status === "known" &&
    deniedReleaseIds.includes(identity.value)
  ) {
    return {
      status: "unsupported",
      reasons: [{ code: "known-regression", subject: "web" }],
      remediation: [{ route: "web", level: "required" }],
    };
  }

  return { status: "supported", reasons: [], remediation: [] };
};

// The application's own draft service: it outlives every boot, as a store of drafts does.
const createDrafts = (log: string[]) => {
  const state = { text: "an unsaved paragraph", saved: "", paused: false };

  const participant: DisruptionParticipant = {
    name: "drafts",
    reserve: () => {
      log.push("reserve");
      state.paused = true;

      return {
        status: "reserved",
        settle: async () => {
          state.saved = state.text;
          log.push("flush");

          return { status: "ready" };
        },
        resume: () => {
          state.paused = false;
        },
      };
    },
  };

  return { state, participant };
};

const boot = ({
  id,
  running,
  window,
  storage,
  serves,
}: {
  id: string;
  running: string;
  window: ReturnType<typeof fakeWindow>;
  storage: ReturnType<typeof createMockJournalStorage>;
  serves: Manifest;
}) => {
  const mock = createMockSource<Manifest>({ name: "manifest" });

  mock.answer({ document: serves, revision: REVISION, digest: "decision-208" });

  const source = mock.source;

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id }, web: webBuild({ id: running }) },
    routes: {
      web: targetRoute({
        source: source.select((document) => document.web),
        mechanism: browserReload({ target: window }),
      }),
    },
    policy: supportPolicy({
      source: source.select((document) => document.support),
      evaluate,
    }),
    journal: { mode: "required", storage },
    clock: createTestClock({ now: 1_000 }),
  });

  return beacon;
};

test("Story A a rollback is offered over a draft, which is saved, journaled and only then requested, and the next boot is read back", async () => {
  const log: string[] = [];
  const storage = createMockJournalStorage();
  const drafts = createDrafts(log);
  const window = fakeWindow();

  const first = boot({
    id: "boot-1",
    running: "web-build-b",
    window,
    storage,
    serves: manifest("web-build-a", ["web-build-b"]),
  });

  first.disruptions.register(drafts.participant);
  first.start();
  await first.check({ reason: "startup" });

  // Target mode offers build A whatever its order, and B is unsupported with the route as its required remediation.
  const { observation } = first.route("web").state.get();

  expect(observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-a" } },
    evidence: { revision: REVISION },
  });
  expect(first.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: {
      remediation: [{ route: "web", level: "required", usable: true }],
    },
  });

  // Nothing forced a save: the draft is still the user's, and no reload was asked for.
  expect(drafts.state.saved).toBe("");
  expect(window.reloads()).toBe(0);

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  const writesBefore = storage.writes();
  const outcome = await first.route("web").reload({ offer: observation.offer });

  // The draft service was reserved and flushed before the intent was written, and the intent before the navigation.
  expect(log).toEqual(["reserve", "flush"]);
  expect(drafts.state.saved).toBe("an unsaved paragraph");
  expect(storage.writes()).toBe(writesBefore + 1);
  expect(window.reloads()).toBe(1);
  expect(outcome).toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });

  // The request is no installation: build B still runs, the route is unresolved and the draft service stays paused until the application says the old document goes on.
  expect(first.running.get().web).toMatchObject({
    release: { identity: { value: "web-build-b" } },
  });
  expect(first.route("web").state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "dispatch-unconfirmed",
  });
  expect(drafts.state.paused).toBe(true);

  // The next boot runs A, from the same storage, and finds an intent that its running facts now meet.
  const second = boot({
    id: "boot-2",
    running: "web-build-a",
    window: fakeWindow(),
    storage,
    serves: manifest("web-build-a", ["web-build-b"]),
  });

  second.start();
  await settle();

  expect(second.transitions.get().latest).toMatchObject({
    outcome: "target-running",
    intent: {
      boot: { id: "boot-1" },
      command: "reload",
      binding: "unpinned-navigation",
      target: { value: "web-build-a" },
    },
  });

  // The draft comes back from what the service saved, and readiness is the application's own checkpoint, unknown until it reports one.
  expect(drafts.state.saved).toBe("an unsaved paragraph");
  expect(second.transitions.get().checkpoints).toEqual([]);

  second.reportReady({ checkpoint: "primary-screen" });
  expect(second.transitions.get().checkpoints).toEqual(["primary-screen"]);

  await second.check({ reason: "startup" });
  expect(second.route("web").state.get().observation).toMatchObject({
    status: "none",
    reason: "same-identity",
  });
  expect(second.support.get()).toMatchObject({ status: "supported" });
});

test("Story A a CDN that serves build B again leaves the target unreached boot after boot, counted against the budget, and claims no installation", async () => {
  const storage = createMockJournalStorage();
  const serves = manifest("web-build-a", ["web-build-b"]);
  const attempts: Array<{ attempts: number; exhausted: boolean }> = [];

  // Every boot is served build B, and asks again for A.
  for (const id of ["boot-1", "boot-2", "boot-3", "boot-4"]) {
    const window = fakeWindow();

    const beacon = boot({
      id,
      running: "web-build-b",
      window,
      storage,
      serves,
    });

    beacon.disruptions.register(createDrafts([]).participant);
    beacon.start();
    await settle();

    const { latest } = beacon.transitions.get();

    if (latest !== null) {
      expect(latest).toMatchObject({
        outcome: "target-not-running",
        intent: { target: { value: "web-build-a" } },
      });
      attempts.push({
        attempts: latest.attempts,
        exhausted: latest.exhausted,
      });
    }

    await beacon.check();

    // The build that was served again is still unsupported, and nothing was relabeled as installed.
    expect(beacon.support.get()).toMatchObject({ status: "unsupported" });
    expect(beacon.running.get().web).toMatchObject({
      release: { identity: { value: "web-build-b" } },
    });

    const { observation } = beacon.route("web").state.get();

    if (observation.status !== "available") {
      throw new Error("The web route has no offer.");
    }

    await beacon.route("web").reload({ offer: observation.offer });
    expect(window.reloads()).toBe(1);
  }

  expect(attempts).toEqual([
    { attempts: 1, exhausted: false },
    { attempts: 2, exhausted: false },
    { attempts: 3, exhausted: true },
  ]);
});

test("WEB-05 a next document with a different unexpected build is recorded as what runs, and the target is not relabeled as installed", async () => {
  const storage = createMockJournalStorage();
  const serves = manifest("web-build-a", ["web-build-b"]);

  const first = boot({
    id: "boot-1",
    running: "web-build-b",
    window: fakeWindow(),
    storage,
    serves,
  });

  first.start();
  await first.check();

  const { observation } = first.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  await first.route("web").reload({ offer: observation.offer });

  // The reload asked for build A, and a CDN served build Z.
  const next = boot({
    id: "boot-2",
    running: "web-build-z",
    window: fakeWindow(),
    storage,
    serves,
  });

  next.start();
  await settle();

  expect(next.transitions.get().latest).toMatchObject({
    outcome: "different-target",
    intent: { target: { value: "web-build-a" } },
  });
  expect(next.running.get().web).toMatchObject({
    state: "known",
    release: { identity: { value: "web-build-z" } },
  });
});

test("Story J an intent that was persisted before a crash is read back as an intent alone, and nothing is replayed", async () => {
  const storage = createMockJournalStorage();
  const serves = manifest("web-build-a", ["web-build-b"]);

  // The process dies at the navigation: the intent was written and the browser never accepted a reload.
  const crashed = boot({
    id: "boot-1",
    running: "web-build-b",
    window: fakeWindow({ failsToReload: true }),
    storage,
    serves,
  });

  crashed.start();
  await crashed.check();

  const { observation } = crashed.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  await crashed.route("web").reload({ offer: observation.offer });
  expect(storage.writes()).toBe(1);

  // The next boot is served the same build, with a window that counts reloads.
  const window = fakeWindow();

  const next = boot({
    id: "boot-2",
    running: "web-build-b",
    window,
    storage,
    serves,
  });

  next.start();
  await settle();

  const { latest } = next.transitions.get();

  // The intent is visible, relates what runs to what it aimed at, and says nothing about a dispatch or an installation.
  expect(latest).toMatchObject({
    outcome: "target-not-running",
    intent: {
      boot: { id: "boot-1" },
      command: "reload",
      target: { value: "web-build-a" },
    },
  });
  expect(Object.keys(latest?.intent ?? {}).sort()).toEqual([
    "binding",
    "boot",
    "command",
    "createdAt",
    "current",
    "expiresAt",
    "operation",
    "route",
    "subject",
    "target",
  ]);

  // The stored command is not replayed: no reload, no operation, and a route that takes commands as before.
  await next.check();
  await settle();
  expect(window.reloads()).toBe(0);
  expect(next.route("web").state.get().operation).toEqual({ state: "idle" });
});
