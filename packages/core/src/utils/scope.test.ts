import { expect, test } from "vitest";

import type { ReleaseScope } from "src/types/ReleaseScope";
import { SCOPE, settle } from "src/utils/Beacon.fixture";
import {
  ACCEPTED_RELOAD,
  answerWithBuild,
  createWebCommandBeacon,
  startWithOffer,
  takeRun,
} from "src/utils/commands.fixture";
import {
  buildIntent,
  buildStored,
  createMemoryStorage,
} from "src/utils/journal.fixture";
import { target } from "src/utils/routes.fixture";
import { createJournalKey } from "src/utils/internal/journal/createJournalKey";
import { serializeJournal } from "src/utils/internal/journal/serializeJournal";
import {
  answer,
  buildDocument,
  createPolicyBeacon,
  evaluateSupport,
} from "src/utils/policy.fixture";

const STAGING: ReleaseScope = { ...SCOPE, environment: "staging" };

test("replacing the scope makes the next read speak for the next scope", async () => {
  const context = createWebCommandBeacon();

  context.mock.answer({
    document: { web: target("web-build-a"), policy: { minimum: "1.0.0" } },
    expiresAt: 601_000,
  });
  context.beacon.start();
  await context.beacon.route("web").check();

  expect(context.beacon.replaceScope(STAGING)).toEqual({ status: "replaced" });

  await context.beacon.route("web").check();

  expect(context.mock.contexts().map(({ scope }) => scope.environment)).toEqual(
    ["production", "staging"],
  );
});

test("LIFE-09 the running facts are not rewritten by the scope, and the build in memory stays the build", async () => {
  const context = createWebCommandBeacon({ build: "web-build-b" });

  context.beacon.start();
  await settle();
  context.beacon.replaceScope(STAGING);
  await settle();

  expect(context.beacon.running.get().web).toMatchObject({
    state: "known",
    release: { identity: { value: "web-build-b" } },
  });
});

test("what the last scope taught is forgotten, and an offer it made is stale", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  context.beacon.replaceScope(STAGING);

  expect(web.state.get()).toMatchObject({
    check: { state: "idle" },
    observation: { status: "unknown", reason: "not-checked" },
    operation: { state: "idle" },
  });
  await expect(web.requestReload({ offer })).resolves.toEqual({
    status: "stale",
    reason: "replaced",
  });
  expect(context.runs).toHaveLength(0);
});

test("LIFE-08 an operation that is running blocks the replacement, and the old scope stays in force", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reloading = web.requestReload({ offer });

  await settle();

  expect(context.beacon.replaceScope(STAGING)).toEqual({
    status: "blocked",
    route: "web",
  });

  const checking = web.check();

  await settle();
  answerWithBuild(context.mock, "web-build-a", "208");
  await checking;

  expect(context.mock.contexts().map(({ scope }) => scope.environment)).toEqual(
    ["production", "production"],
  );

  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reloading;
});

test("LIFE-08 an operation that is indeterminate blocks it until the application acknowledges", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reloading = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reloading;

  expect(web.state.get().operation).toMatchObject({ state: "indeterminate" });
  expect(context.beacon.replaceScope(STAGING)).toEqual({
    status: "blocked",
    route: "web",
  });

  web.acknowledge();

  expect(context.beacon.replaceScope(STAGING)).toEqual({ status: "replaced" });
});

test("LIFE-08 stopping the session does not free an operation for another scope", async () => {
  const context = createWebCommandBeacon();
  const offer = await startWithOffer(context);
  const reloading = context.beacon.route("web").requestReload({ offer });

  await settle();
  context.beacon.stop();

  expect(context.beacon.replaceScope(STAGING)).toEqual({
    status: "blocked",
    route: "web",
  });

  await reloading;
});

test("a read of the old scope that answers after the replacement is dropped", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");

  context.beacon.start();

  const checking = web.check();

  await settle();
  context.beacon.replaceScope(STAGING);
  answerWithBuild(context.mock, "web-build-a", "208");
  await checking;

  expect(web.state.get().observation).toMatchObject({
    status: "unknown",
    reason: "not-checked",
  });
});

test("the same scope is left alone", async () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");

  await startWithOffer(context);

  const held = web.state.get();

  expect(context.beacon.replaceScope({ ...SCOPE })).toEqual({
    status: "unchanged",
  });
  expect(web.state.get()).toBe(held);
});

test("a Beacon that is stopped takes the scope for its next start, and stays stopped", async () => {
  const context = createWebCommandBeacon();

  await startWithOffer(context);
  context.beacon.stop();

  expect(context.beacon.replaceScope(STAGING)).toEqual({ status: "replaced" });
  expect(context.beacon.status.get().state).toBe("stopped");

  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();
  answerWithBuild(context.mock, "web-build-a", "208");
  await checking;

  expect(context.mock.contexts().at(-1)?.scope.environment).toBe("staging");
});

test("an open session starts again with the next scope, one session after the other", async () => {
  const context = createWebCommandBeacon();

  context.beacon.start();

  expect(context.beacon.status.get()).toEqual({ state: "running", session: 1 });

  context.beacon.replaceScope(STAGING);

  expect(context.beacon.status.get()).toEqual({ state: "running", session: 2 });
});

test("a disposed Beacon refuses a scope", () => {
  const context = createWebCommandBeacon();

  context.beacon.dispose();

  expect(() => context.beacon.replaceScope(STAGING)).toThrow(
    expect.objectContaining({ code: "DISPOSED" }),
  );
});

test("the support evaluated for the last scope is forgotten with it", async () => {
  const context = createPolicyBeacon();

  context.beacon.start();

  const checking = context.beacon.check();

  await settle();
  answer(context.mock, buildDocument(), 601_000);
  await checking;

  expect(context.beacon.support.get().status).toBe("unsupported");

  context.beacon.replaceScope(STAGING);

  expect(context.beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "not-checked",
    evaluation: null,
  });
});

test("the journal reads the record of the next scope, and shows nothing of the last", async () => {
  const memory = createMemoryStorage();

  const context = createWebCommandBeacon({
    journal: { mode: "best-effort", storage: memory.storage },
  });

  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reloading = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reloading;
  web.acknowledge();

  expect(context.beacon.transitions.get().latest).not.toBeNull();

  context.beacon.replaceScope(STAGING);
  await settle();

  expect(context.beacon.transitions.get().latest).toBeNull();
  expect(memory.data.has(createJournalKey(SCOPE))).toBe(true);
  expect(memory.data.has(createJournalKey(STAGING))).toBe(false);
});

test("the journal reads the record of the next scope, whatever the last one held", async () => {
  const memory = createMemoryStorage();

  const context = createWebCommandBeacon({
    journal: { mode: "best-effort", storage: memory.storage },
  });

  context.beacon.start();
  await settle();

  memory.data.set(
    createJournalKey(STAGING),
    serializeJournal([buildStored(buildIntent({ boot: { id: "boot-0" } }))]),
  );

  context.beacon.replaceScope(STAGING);
  await settle();

  expect(context.beacon.transitions.get().latest).toMatchObject({
    intent: { boot: { id: "boot-0" } },
  });
});

test("the intents of the last scope are not shown for the next when its record cannot be read", async () => {
  const memory = createMemoryStorage();

  const context = createWebCommandBeacon({
    journal: { mode: "best-effort", storage: memory.storage },
  });

  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");
  const reloading = web.requestReload({ offer });

  await settle();
  takeRun(context.runs).settleWith(ACCEPTED_RELOAD);
  await reloading;
  web.acknowledge();

  memory.failReads(new Error("storage offline"));
  context.beacon.replaceScope(STAGING);
  await settle();

  expect(context.beacon.transitions.get()).toMatchObject({
    journal: "degraded",
    latest: null,
  });
});

test("the last valid support of a scope is not kept beside a failure of the next", async () => {
  const policy = { failing: false };

  const context = createPolicyBeacon({
    evaluate: (support, running) => {
      if (policy.failing) {
        throw new Error("The policy of the next scope cannot be evaluated.");
      }

      return evaluateSupport(support, running);
    },
  });

  context.beacon.start();

  const checking = context.beacon.check();

  await settle();
  answer(context.mock, buildDocument(), 601_000);
  await checking;

  expect(context.beacon.support.get().evaluation).not.toBeNull();

  context.beacon.replaceScope(STAGING);
  policy.failing = true;

  const rechecking = context.beacon.check();

  await settle();
  answer(context.mock, buildDocument(), 601_000);
  await rechecking;

  expect(context.beacon.support.get()).toMatchObject({
    evaluation: null,
    error: { code: "POLICY_FAILED" },
  });
});

test("a route that learned nothing is not told that it forgot it", () => {
  const context = createWebCommandBeacon();
  const web = context.beacon.route("web");
  const held = web.state.get();
  const heard: number[] = [];

  web.state.subscribe(() => {
    heard.push(web.state.get().revision);
  });

  context.beacon.replaceScope(STAGING);

  expect(heard).toEqual([]);
  expect(web.state.get()).toBe(held);
});
