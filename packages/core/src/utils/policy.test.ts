import { expect, test } from "vitest";

import { createMockSource } from "src/mock/createMockSource";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RunningRelease } from "src/types/RunningRelease";
import type { SupportVerdict } from "src/types/SupportVerdict";
import {
  buildWebRelease,
  createBeacon,
  createRoutedBeacon,
  settle,
} from "src/utils/Beacon.fixture";
import { DEFAULT_RUNNING_TIMEOUT } from "src/utils/constants/defaults";
import { createReleaseSource } from "src/utils/createReleaseSource";
import { createDeferred } from "src/utils/internal/common/createDeferred";
import { supportPolicy } from "src/utils/supportPolicy";
import {
  answer,
  buildDocument,
  buildNativeRelease,
  candidate,
  createPolicyBeacon,
  createPolicyRoutes,
  evaluateSupport,
} from "src/utils/policy.fixture";
import type { PolicyManifest } from "src/utils/policy.fixture";

const checkWith = async (
  context: ReturnType<typeof createPolicyBeacon>,
  document = buildDocument(),
  expiresAt: number | undefined = 601_000,
) => {
  const checking = context.beacon.check();

  await settle();
  answer(context.mock, document, expiresAt);

  return checking;
};

test("a Beacon without a policy has unknown support, and its report says there is none", async () => {
  const { beacon } = createBeacon();

  expect(beacon.support.get()).toEqual({
    revision: 0,
    status: "unknown",
    reason: "no-policy",
    evaluation: null,
    error: null,
  });

  beacon.start();

  await expect(beacon.check()).resolves.toEqual({ routes: {}, support: null });
});

test("POL-01 a first policy check that fails is unknown, not supported and not unsupported", async () => {
  const context = createPolicyBeacon();

  context.beacon.start();

  const checking = context.beacon.check();

  await settle();
  context.mock.reject(new Error("offline"));

  const report = await checking;

  expect(report.support).toMatchObject({ status: "failed" });
  expect(context.beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "not-checked",
    evaluation: null,
  });
});

test("HTTP-01 the routes and the policy of one source share a single read and one accepted document", async () => {
  const context = createPolicyBeacon();

  context.beacon.start();
  await checkWith(context);

  expect(context.mock.stats().reads).toBe(1);
  expect(context.beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
  });
  expect(context.beacon.support.get()).toMatchObject({ status: "unsupported" });
});

test("HTTP-01 one check reads a source once, even when the source answers at once", async () => {
  const state = { reads: 0 };

  const source = createReleaseSource<PolicyManifest>({
    name: "manifest",
    read: async () => {
      state.reads += 1;

      return { document: buildDocument() };
    },
  });

  const { beacon } = createRoutedBeacon(createPolicyRoutes(source), {
    running: {
      boot: { id: "boot-1" },
      web: () => buildWebRelease("web-build-b"),
      native: () => buildNativeRelease(100),
    },
    policy: supportPolicy({
      source: source.select((manifest) => manifest.support),
      evaluate: evaluateSupport,
    }),
  });

  beacon.start();

  const report = await beacon.check();

  expect(state.reads).toBe(1);
  expect(report.routes.web).toMatchObject({ status: "succeeded", attempt: 1 });
  expect(report.support).toMatchObject({ status: "succeeded", attempt: 1 });
});

test("a check reports the routes and the policy apart, and a failing policy never hides a successful route", async () => {
  const context = createPolicyBeacon({
    evaluate: () => {
      throw new Error("bad policy");
    },
  });

  context.beacon.start();

  const report = await checkWith(context);

  expect(report.routes.web).toMatchObject({ status: "succeeded" });
  expect(report.support).toMatchObject({
    status: "failed",
    error: { code: "POLICY_FAILED" },
  });
});

test("POL-02 an accepted policy inside its validity is used as evidence, without a fresh check", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);

  const before = context.beacon.support.get();

  context.clock.advance(100_000);

  expect(context.beacon.support.get()).toBe(before);
  expect(before).toMatchObject({
    status: "unsupported",
    evaluation: { evidence: { freshness: "fresh", receivedAt: 1_000 } },
  });
  expect(context.mock.stats().reads).toBe(1);
});

test("POL-03 a policy that expires is unknown, and its last decision stays beside it", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);
  context.clock.advance(600_000);

  expect(context.beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "expired",
    evaluation: { status: "unsupported", evidence: { freshness: "expired" } },
  });
});

test("POL-04 a restart does not renew a policy that lapsed while the Beacon was stopped", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);
  context.beacon.stop();
  context.clock.advance(700_000);
  context.beacon.start();
  await settle();

  expect(context.beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "expired",
  });
  expect(context.mock.stats().reads).toBe(1);
});

test("POL-05 a download does not lift an unmet native minimum", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);

  await expect(context.beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
  expect(context.beacon.support.get()).toMatchObject({ status: "unsupported" });
});

test("POL-06 opening a store does not lift an unmet native minimum", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);

  await expect(
    context.beacon.route("binary").prefetch(),
  ).resolves.toMatchObject({
    status: "accepted",
  });
  expect(context.beacon.support.get()).toMatchObject({ status: "unsupported" });
});

test("POL-07 a new running native build that satisfies the policy lifts the requirement", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);

  expect(context.beacon.support.get()).toMatchObject({ status: "unsupported" });

  context.beacon.stop();
  context.running.native = buildNativeRelease(120);
  context.beacon.start();
  await settle();

  expect(context.beacon.support.get()).toMatchObject({
    status: "supported",
    evaluation: { evaluatedRunningRevision: expect.any(Number) },
  });
});

test("POL-08 a new valid policy lifts the requirement without any release change", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);

  const offer = context.beacon.route("web").state.get().observation;

  const rechecking = context.beacon.check();

  await settle();
  answer(
    context.mock,
    buildDocument({ support: { minimumBuild: 80, deprecatedBelow: 80 } }),
  );
  await rechecking;

  expect(context.beacon.support.get()).toMatchObject({ status: "supported" });
  expect(context.beacon.route("web").state.get().observation).toMatchObject({
    offer: {
      ref: (offer.status === "available" && offer.offer.ref) || undefined,
    },
  });
});

test("POL-09 unsupported with a required route that has nothing to offer is a state of its own", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(
    context,
    buildDocument({ binary: { kind: "none", reason: "no-release" } }),
  );

  const { status, evaluation } = context.beacon.support.get();

  expect(status).toBe("unsupported");
  expect(evaluation?.remediation).toEqual([
    { route: "binary", level: "required", usable: false },
  ]);
});

test("a required route that has an offer is a usable remediation", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);

  expect(context.beacon.support.get().evaluation?.remediation).toEqual([
    { route: "binary", level: "required", usable: true },
  ]);
});

test("POL-10 a policy that names a route the Beacon does not have fails, and creates no command", async () => {
  const mock = createMockSource<PolicyManifest>({ name: "manifest" });

  const routes: Record<string, RouteDefinition> = createPolicyRoutes(
    mock.source,
  );

  const policy = supportPolicy({
    source: mock.source.select((manifest) => manifest.support),
    evaluate: (): SupportVerdict => ({
      status: "unsupported",
      reasons: [],
      remediation: [{ route: "ghost", level: "required" }],
    }),
  });

  const { beacon } = createRoutedBeacon(routes, { policy });

  beacon.start();

  const checking = beacon.check();

  await settle();
  answer(mock, buildDocument());

  await expect(checking).resolves.toMatchObject({
    support: { status: "failed", error: { code: "POLICY_FAILED" } },
  });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "evaluation-failed",
    error: { code: "POLICY_FAILED" },
  });
});

test("POL-13 a policy that meets a native build not read yet is told so, not given version zero", async () => {
  const seen: string[] = [];

  const context = createPolicyBeacon({
    holdNative: true,
    evaluate: (support, running) => {
      seen.push(running.native.state);

      return evaluateSupport(support, running);
    },
  });

  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();
  answer(context.mock, buildDocument());
  await checking;

  expect(seen).toContain("pending");
  expect(context.beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: null,
    evaluation: {
      reasons: [{ code: "native-build-unknown", subject: "native" }],
    },
  });
});

// A Beacon whose only route reads the web build, and whose policy reads the native one, which nothing else waits for.
const createNativePolicyBeacon = (native: () => Promise<RunningRelease>) => {
  const mock = createMockSource<PolicyManifest>({ name: "manifest" });
  const { web } = createPolicyRoutes(mock.source);

  const context = createRoutedBeacon(
    { web },
    {
      running: {
        boot: { id: "boot-1" },
        web: () => buildWebRelease("web-build-b"),
        native,
      },
      policy: supportPolicy({
        source: mock.source.select((manifest) => manifest.support),
        evaluate: (_support, running): SupportVerdict<"web"> => {
          if (running.native.state !== "known") {
            return {
              status: "unknown",
              reasons: [{ code: "native-build-unknown", subject: "native" }],
              remediation: [],
            };
          }

          return { status: "supported", reasons: [], remediation: [] };
        },
      }),
    },
  );

  return { ...context, mock };
};

test("POL-13 a check that includes the policy starts no read until every running fact the policy may read is in", async () => {
  const held = createDeferred<RunningRelease>();
  const context = createNativePolicyBeacon(() => held.promise);

  context.beacon.start();

  const checking = context.beacon.check();

  await settle();

  expect(context.mock.stats().reads).toBe(0);

  held.resolve(buildNativeRelease(100));
  await settle();
  answer(context.mock, buildDocument());

  await expect(checking).resolves.toMatchObject({
    routes: { web: { status: "succeeded" } },
    support: { status: "succeeded" },
  });
  expect(context.beacon.support.get().status).toBe("supported");
});

test("POL-13 a fact that never answers is a failed one once its time is up, and the check goes on with the policy told so", async () => {
  const context = createNativePolicyBeacon(() => new Promise(() => {}));

  context.beacon.start();

  const checking = context.beacon.check();

  await settle();
  context.clock.advance(DEFAULT_RUNNING_TIMEOUT);
  await settle();
  answer(context.mock, buildDocument());

  await expect(checking).resolves.toMatchObject({
    support: { status: "succeeded" },
  });
  expect(context.beacon.running.get().native.state).toBe("failed");
  expect(context.beacon.support.get()).toMatchObject({
    status: "unknown",
    evaluation: {
      reasons: [{ code: "native-build-unknown", subject: "native" }],
    },
  });
});

test("POL-13 a route's own check still waits only for the subject it depends on, however many the policy reads", async () => {
  const context = createNativePolicyBeacon(() => new Promise(() => {}));

  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();
  answer(context.mock, buildDocument());

  await expect(checking).resolves.toMatchObject({ status: "succeeded" });
  expect(context.beacon.running.get().native).toEqual({ state: "pending" });
});

test("POL-14 a policy that throws keeps the last valid evaluation in force and reports the failure beside it", async () => {
  const state = { broken: false };

  const context = createPolicyBeacon({
    build: 90,
    evaluate: (support, running) => {
      if (state.broken) {
        throw new Error("bad policy");
      }

      return evaluateSupport(support, running);
    },
  });

  context.beacon.start();
  await checkWith(context);

  state.broken = true;

  const rechecking = context.beacon.check();

  await settle();
  answer(
    context.mock,
    buildDocument({ support: { minimumBuild: 109, deprecatedBelow: 100 } }),
  );

  const report = await rechecking;

  expect(report.support).toMatchObject({
    status: "failed",
    error: { code: "POLICY_FAILED" },
  });
  expect(context.beacon.support.get()).toMatchObject({
    status: "unsupported",
    reason: null,
    error: { code: "POLICY_FAILED" },
  });
});

test("POL-14 the evaluation kept beside a failure says whether its routes are usable now, not when it was made", async () => {
  const state = { broken: false };

  const context = createPolicyBeacon({
    build: 90,
    evaluate: (support, running) => {
      if (state.broken) {
        throw new Error("bad policy");
      }

      return evaluateSupport(support, running);
    },
  });

  context.beacon.start();
  await checkWith(
    context,
    buildDocument({ binary: { kind: "none", reason: "no-release" } }),
  );

  expect(context.beacon.support.get().evaluation?.remediation).toEqual([
    { route: "binary", level: "required", usable: false },
  ]);

  state.broken = true;

  // The read that breaks the policy is also the one that brings the binary its offer.
  await checkWith(
    context,
    buildDocument({ support: { minimumBuild: 109, deprecatedBelow: 100 } }),
  );

  expect(context.beacon.support.get()).toMatchObject({
    error: { code: "POLICY_FAILED" },
    evaluation: {
      remediation: [{ route: "binary", level: "required", usable: true }],
    },
  });
});

test("POL-14 an answer that is not a verdict fails the evaluation, and the check still answers", async () => {
  const context = createPolicyBeacon({
    // A host that is not typed can answer with anything.
    evaluate: () => JSON.parse('{"status":"supported","remediation":[]}'),
  });

  context.beacon.start();

  await expect(checkWith(context)).resolves.toMatchObject({
    routes: { web: { status: "succeeded" } },
    support: { status: "failed", error: { code: "POLICY_FAILED" } },
  });
  expect(context.beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "evaluation-failed",
    evaluation: null,
  });
});

test("a change to a fact the verdict does not depend on keeps the support snapshot", async () => {
  const context = createPolicyBeacon({ build: 90 });

  context.beacon.start();
  await checkWith(context);

  const before = context.beacon.support.get();
  const revision = context.beacon.running.get().revision;

  context.beacon.stop();
  context.running.web = buildWebRelease("web-build-c");
  context.beacon.start();
  await settle();

  expect(context.beacon.running.get().revision).toBeGreaterThan(revision);
  expect(context.beacon.support.get()).toBe(before);
});

test("the policy is evaluated again only when the document or the running facts change", async () => {
  const calls = { count: 0 };

  const context = createPolicyBeacon({
    build: 90,
    evaluate: (support, running) => {
      calls.count += 1;

      return evaluateSupport(support, running);
    },
  });

  context.beacon.start();
  await checkWith(context);

  const evaluated = calls.count;

  await context.beacon.route("web").prefetch();
  context.beacon.route("binary").state.get();

  expect(calls.count).toBe(evaluated);
});

test("the candidate helper names a build in the version-code domain", () => {
  expect(candidate(120).release.identity).toEqual({
    status: "known",
    authority: "com.example.notes",
    domain: "android-version-code",
    value: "120",
  });
});

test("a route check waits only for the running subject it depends on, not for every reader", async () => {
  const context = createPolicyBeacon({ holdNative: true });

  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();
  answer(context.mock, buildDocument());

  await expect(checking).resolves.toMatchObject({ status: "succeeded" });
  expect(context.beacon.running.get().native).toEqual({ state: "pending" });
});

test("POL-05 a policy that lapses while its evaluation fails is unknown, not the last verdict as if it still held", async () => {
  const state = { failing: false };

  const context = createPolicyBeacon({
    evaluate: (support, running) => {
      if (state.failing) {
        throw new Error("The policy cannot be evaluated any more.");
      }

      return evaluateSupport(support, running);
    },
  });

  context.beacon.start();

  const checking = context.beacon.check();

  await settle();
  answer(context.mock, buildDocument(), 2_000);
  await checking;

  expect(context.beacon.support.get().status).toBe("unsupported");

  state.failing = true;
  context.clock.advance(1_500);

  expect(context.beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "expired",
    error: { code: "POLICY_FAILED" },
  });
});
