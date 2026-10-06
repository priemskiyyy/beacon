import { expect, test } from "vitest";

import { createMockSource } from "src/mock/createMockSource";
import { createTestClock } from "src/mock/createTestClock";
import { settle } from "src/mock/settle";
import type { DriverEmitter } from "src/types/DriverEmitter";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RouteBody } from "src/types/RouteBody";
import type { SupportVerdict } from "src/types/SupportVerdict";
import type { TargetDecision } from "src/types/TargetDecision";
import { Beacon } from "src/utils/Beacon";
import { buildWebRelease, SCOPE } from "src/utils/Beacon.fixture";
import { createReleaseDriver } from "src/utils/createReleaseDriver";
import { createReloadMechanism, target } from "src/utils/routes.fixture";
import { supportPolicy } from "src/utils/supportPolicy";
import { targetRoute } from "src/utils/targetRoute";

// The stories play the specification's end-to-end cases with the public API alone: sources the test holds and releases, a provider driver it scripts, and a policy of the application's own.

type Manifest = {
  web: TargetDecision;
  support: { deniedReleaseIds: string[] };
};

const BODY: RouteBody = {
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "android-version-code",
      value: "120",
    },
  },
};

const answerOf = (account: string, web: string, denied: string[]) => ({
  document: { web: target(web), support: { deniedReleaseIds: denied } },
  digest: account,
  expiresAt: 601_000,
});

test("Story H a scope that changes during a slow response is not touched by the answer or the cleanup of the one that ended", async () => {
  const manifest = createMockSource<Manifest>({ name: "manifest" });
  const { mechanism } = createReloadMechanism();

  const opened: Array<{
    scope: ReleaseScope;
    native: { scope: string };
    emit: DriverEmitter<RouteBody, RouteBody>;
    disposed: boolean;
  }> = [];

  const ota = createReleaseDriver<
    { scope: string },
    RouteBody,
    RouteBody,
    Record<never, never>
  >({
    name: "provider",
    subject: "bundle",
    prepares: false,
    open: ({ scope, emit }) => {
      const session = {
        scope,
        native: { scope: scope.environment },
        emit,
        disposed: false,
      };

      opened.push(session);

      return {
        native: session.native,
        check: async () => ({ status: "available", offer: BODY }),
        dispose: () => {
          session.disposed = true;
        },
      };
    },
    commands: {},
  });

  const evaluate = ({
    deniedReleaseIds,
  }: Manifest["support"]): SupportVerdict<"web"> => {
    if (deniedReleaseIds.length > 0) {
      return { status: "unsupported", reasons: [], remediation: [] };
    }

    return { status: "supported", reasons: [], remediation: [] };
  };

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: () => buildWebRelease("web-build-b"),
    },
    routes: {
      web: targetRoute({
        source: manifest.source.select((document) => document.web),
        mechanism,
      }),
      ota,
    },
    policy: supportPolicy({
      source: manifest.source.select((document) => document.support),
      evaluate,
    }),
    clock: createTestClock({ now: 1_000 }),
  });

  const stop = beacon.start();

  await settle();

  // Scope A has an offer to act on, and a read under way that is slow.
  const first = opened[0];

  if (first === undefined) {
    throw new Error("The provider never opened.");
  }

  manifest.answer({ ...answerOf("a", "web-build-a", []) });
  await beacon.check();

  const staleOffer = beacon.route("web").state.get().observation;

  if (staleOffer.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  const runningBefore = beacon.running.get().web;

  manifest.hold();

  const slow = beacon.check();

  await settle();
  expect(manifest.stats().held).toBe(1);

  // The application switches to scope B, which no operation blocks, and the old session's provider is released at once.
  const staging: ReleaseScope = { ...SCOPE, environment: "staging" };

  expect(beacon.replaceScope(staging)).toEqual({ status: "replaced" });
  expect(first.disposed).toBe(true);
  await settle();
  expect(opened).toHaveLength(2);
  expect(beacon.route("ota").native.get()).toBe(opened[1]?.native);
  expect(beacon.route("web").state.get().observation).toEqual({
    status: "unknown",
    reason: "not-checked",
  });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "not-checked",
  });

  // B starts a read of its own, and A's late answer arrives while it waits.
  const next = beacon.check();

  await settle();
  expect(manifest.stats().held).toBe(2);
  manifest.resolve(answerOf("a", "web-build-z", ["web-build-b"]));
  await settle();

  // Nothing A said reached B: not its offers, its support, its provider or its waiter.
  expect(beacon.route("web").state.get().observation).toEqual({
    status: "unknown",
    reason: "not-checked",
  });
  expect(beacon.support.get()).toMatchObject({ reason: "not-checked" });
  await expect(slow).resolves.toMatchObject({
    routes: { web: { status: "superseded" } },
    support: { status: "superseded" },
  });

  // The provider session that ended may still call, and is counted and dropped.
  first.emit.observation({
    status: "none",
    reason: "no-decision",
    detail: null,
  });
  expect(beacon.route("ota").state.get().observation).not.toMatchObject({
    status: "none",
  });
  expect(beacon.diagnostics.get().counters.lateCallbacks).toBeGreaterThan(0);

  // B's own answer is the one that counts, and its waiter is B's.
  manifest.resolve(answerOf("b", "web-build-c", []));

  const report = await next;

  expect(report.routes.web).toMatchObject({ status: "succeeded" });
  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build web-build-c" } },
  });
  expect(beacon.support.get()).toMatchObject({ status: "supported" });

  // Every offer reference of A is invalid, and what runs is what ran.
  await expect(
    beacon.route("web").reload({ offer: staleOffer.offer }),
  ).resolves.toMatchObject({ status: "stale" });
  expect(beacon.running.get().web).toBe(runningBefore);

  // The stop that `start()` answered ends the session the replacement restarted for it, as documented, and never mutates what it taught.
  stop();
  expect(beacon.status.get().state).toBe("stopped");
  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
  });
});
