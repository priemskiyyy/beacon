import { Beacon, supportPolicy } from "@priemskiyyy/beacon";
import type { SupportVerdict } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { integer } from "@priemskiyyy/beacon/versions";
import { expect, test, vi } from "vitest";

import {
  APPLICATION,
  fakeRemoteConfig,
  HOUR,
  SCOPE,
  START,
} from "src/fakeRemoteConfig.fixture";
import type { FakeOptions } from "src/fakeRemoteConfig.fixture";
import { firebaseRemoteConfig } from "src/firebaseRemoteConfig";
import type { FirebaseRemoteConfigOptions } from "src/types/FirebaseRemoteConfigOptions";
import type { RemoteConfigLike } from "src/types/RemoteConfigLike";

const build = integer();

type Setup = Omit<FakeOptions, "now"> & {
  running?: string | null;
  maxAge?: number;
  name?: string;
  onFetchFailure?: FirebaseRemoteConfigOptions<
    RemoteConfigLike,
    unknown
  >["onFetchFailure"];
};

const unknown = (code: string): SupportVerdict<never> => ({
  status: "unknown",
  reasons: [{ code, subject: "native" }],
  remediation: [],
});

// The forced-upgrade policy of the documentation: the build that runs against a minimum build the server keeps.
const create = ({ running = "110", ...setup }: Setup = {}) => {
  const clock = createTestClock({ now: START });
  const fake = fakeRemoteConfig({ now: clock.now, ...setup });

  fake.serve({ minimum_build: "120" });

  const config = firebaseRemoteConfig({
    remoteConfig: fake.remoteConfig,
    sdk: fake.sdk,
    document: ({ remote }) => ({
      minimumBuild: build.parse(remote("minimum_build")),
    }),
    ...(setup.name === undefined ? {} : { name: setup.name }),
    ...(setup.maxAge === undefined ? {} : { maxAge: setup.maxAge }),
    ...(setup.onFetchFailure === undefined
      ? {}
      : { onFetchFailure: setup.onFetchFailure }),
  });

  const policy = supportPolicy({
    source: config.select((document) => document.minimumBuild),
    evaluate: (minimumBuild, facts): SupportVerdict<never> => {
      const { native } = facts;

      if (native.state !== "known") {
        return unknown("native-build-not-read");
      }

      const { identity } = native.release;

      if (identity.status !== "known") {
        return unknown("native-build-unreadable");
      }

      if (
        build.compare(build.parse(identity.value), minimumBuild) === "older"
      ) {
        return {
          status: "unsupported",
          reasons: [{ code: "native-build-too-old", subject: "native" }],
          remediation: [],
        };
      }

      return { status: "supported", reasons: [], remediation: [] };
    },
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      native: () => {
        if (running === null) {
          throw new Error("The native module is not there.");
        }

        return {
          identity: {
            status: "known",
            authority: APPLICATION,
            domain: "android-version-code",
            value: running,
          },
          label: "1.4.0",
          raw: {
            applicationId: APPLICATION,
            versionName: "1.4.0",
            versionCode: running,
          },
        };
      },
    },
    routes: {},
    policy,
    clock,
  });

  return { beacon, clock, fake };
};

test("a minimum build above the running one is unsupported, on evidence dated by the fetch and named for the source", async () => {
  const { beacon, fake } = create();

  beacon.start();

  const report = await beacon.check();
  const support = beacon.support.get();

  expect(report.support).toMatchObject({ status: "succeeded" });
  expect(support).toMatchObject({
    status: "unsupported",
    reason: null,
    evaluation: {
      status: "unsupported",
      reasons: [{ code: "native-build-too-old", subject: "native" }],
      evidence: {
        source: "firebase-remote-config",
        origin: "network",
        receivedAt: START,
        expiresAt: START + 12 * HOUR,
        freshness: "fresh",
        issuer: null,
        revision: null,
      },
    },
  });
  expect(fake.calls.network).toBe(1);
});

test("a minimum build the running one meets is supported", async () => {
  const { beacon } = create({ running: "120" });

  beacon.start();
  await beacon.check();

  expect(beacon.support.get()).toMatchObject({
    status: "supported",
    evaluation: { evidence: { freshness: "fresh" } },
  });
});

test("the source is named for the application's choice in the evidence", async () => {
  const { beacon } = create({ name: "support-gate" });

  beacon.start();
  await beacon.check();

  expect(beacon.support.get()).toMatchObject({
    evaluation: { evidence: { source: "support-gate" } },
  });
});

test("a key the server does not have fails the check and leaves support unknown, and never supported on a fresh, succeeded answer", async () => {
  const { beacon, fake } = create();

  fake.serve({ other_key: "1" });
  beacon.start();

  const report = await beacon.check();

  expect(report.support).toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "read-failed",
    evaluation: null,
    error: { code: "SOURCE_FAILED" },
  });
});

test("a default of the application is the same: no server value, no verdict", async () => {
  const { beacon, fake } = create({ defaults: { minimum_build: "0" } });

  fake.serve({});
  beacon.start();

  const report = await beacon.check();

  expect(report.support).toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    evaluation: null,
  });
});

test("a server text that is not a build fails the check with the strategy's own code, and support stays unknown", async () => {
  const { beacon, fake } = create();

  fake.serve({ minimum_build: "" });
  beacon.start();

  const report = await beacon.check();

  expect(report.support).toMatchObject({
    status: "failed",
    error: { code: "INVALID_VERSION" },
  });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    evaluation: null,
  });
});

test("a second check inside the interval reaches no server, and the evidence keeps the time of the fetch", async () => {
  const { beacon, clock, fake } = create();

  beacon.start();
  await beacon.check();

  clock.advance(5 * HOUR);
  await beacon.check();

  expect(fake.calls.network).toBe(1);
  expect(fake.calls.fetchAndActivate).toBe(2);
  expect(beacon.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: { evidence: { expiresAt: START + 12 * HOUR } },
  });
});

test("the evidence lapses with the interval, keeps its verdict beside, and the next check reaches the server again", async () => {
  const { beacon, clock, fake } = create();

  beacon.start();
  await beacon.check();

  clock.advance(13 * HOUR);

  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "expired",
    evaluation: { status: "unsupported" },
  });

  fake.serve({ minimum_build: "100" });
  await beacon.check();

  expect(fake.calls.network).toBe(2);
  expect(beacon.support.get()).toMatchObject({
    status: "supported",
    reason: null,
    evaluation: { evidence: { receivedAt: START + 13 * HOUR } },
  });
});

test("a failed fetch keeps what was accepted: the check says failed, and the verdict ages on its own clock", async () => {
  const { beacon, clock, fake } = create();

  beacon.start();
  await beacon.check();

  clock.advance(13 * HOUR);
  fake.fail(new Error("offline"));

  const report = await beacon.check();

  expect(report.support).toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "read-failed",
    evaluation: { status: "unsupported" },
  });
});

test("an offline cold start fails the check when the activated values are old, the default", async () => {
  const { beacon, fake } = create({
    stored: { at: START - 48 * HOUR, config: { minimum_build: "120" } },
  });

  fake.fail(new Error("offline"));
  beacon.start();

  const report = await beacon.check();

  expect(report.support).toMatchObject({ status: "failed" });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "read-failed",
    evaluation: null,
    error: { code: "SOURCE_FAILED" },
  });
});

test("use-activated answers from the values activated 2 days ago: the check succeeded, although the server did not answer, and the evidence says expired", async () => {
  const { beacon, fake } = create({
    stored: { at: START - 48 * HOUR, config: { minimum_build: "120" } },
    onFetchFailure: "use-activated",
  });

  fake.fail(new Error("offline"));
  beacon.start();

  const report = await beacon.check();

  expect(report.support).toMatchObject({ status: "succeeded" });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "expired",
    evaluation: {
      status: "unsupported",
      evidence: { expiresAt: START - 36 * HOUR },
    },
  });
});

test("use-activated holds as fresh for as long as maxAge says, which is the application's choice", async () => {
  const { beacon, fake } = create({
    stored: { at: START - 13 * HOUR, config: { minimum_build: "120" } },
    onFetchFailure: "use-activated",
    maxAge: 48 * HOUR,
  });

  fake.fail(new Error("offline"));
  beacon.start();
  await beacon.check();

  expect(beacon.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: { evidence: { freshness: "fresh" } },
  });
});

test.each<"fail" | "use-activated">(["fail", "use-activated"])(
  "a configuration that never fetched fails the check in %s mode, and its defaults are no verdict",
  async (onFetchFailure) => {
    const { beacon, fake } = create({
      never: 0,
      defaults: { minimum_build: "0" },
      onFetchFailure,
    });

    fake.fail(new Error("offline"));
    beacon.start();

    const report = await beacon.check();

    expect(report.support).toMatchObject({
      status: "failed",
      error: { code: "SOURCE_FAILED" },
    });
    expect(beacon.support.get()).toMatchObject({
      status: "unknown",
      evaluation: null,
    });
  },
);

test("a first launch offline fails, and the next check that reaches the server answers", async () => {
  const { beacon, fake } = create({ never: 0 });

  fake.fail(new Error("offline"));
  beacon.start();

  await expect(beacon.check()).resolves.toMatchObject({
    support: { status: "failed" },
  });

  fake.fail(null);
  await beacon.check();

  expect(beacon.support.get()).toMatchObject({ status: "unsupported" });
});

test("an interval of zero, as a debug build sets it, makes the answer stale on arrival unless maxAge says how long it holds", async () => {
  const stale = create({ interval: 0 });

  stale.beacon.start();
  await stale.beacon.check();

  expect(stale.beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "expired",
    evaluation: { status: "unsupported" },
  });

  const held = create({ interval: 0, maxAge: HOUR });

  held.beacon.start();
  await held.beacon.check();

  expect(held.beacon.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: { evidence: { expiresAt: START + HOUR, freshness: "fresh" } },
  });
});

test("a fetch slower than the check's timeout fails the check, and the values activate later, for the next check to find", async () => {
  const { beacon, clock, fake } = create();

  fake.hold();
  beacon.start();

  const pending = beacon.check();

  await vi.waitFor(() => expect(fake.calls.fetchAndActivate).toBe(1));

  clock.advance(10_000);

  await expect(pending).resolves.toMatchObject({
    support: { status: "failed", error: { code: "SOURCE_TIMEOUT" } },
  });

  fake.release();
  await vi.waitFor(() => expect(fake.calls.network).toBe(1));

  await beacon.check();

  expect(fake.calls.network).toBe(1);
  expect(beacon.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: { evidence: { expiresAt: START + 10_000 + 12 * HOUR } },
  });
});

test("a fetch that settles after stop() changes nothing", async () => {
  const { beacon, fake } = create();

  fake.hold();
  beacon.start();

  const pending = beacon.check();

  await vi.waitFor(() => expect(fake.calls.fetchAndActivate).toBe(1));

  beacon.stop();
  fake.release();

  await pending;
  await vi.waitFor(() => expect(fake.calls.network).toBe(1));

  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "not-checked",
    evaluation: null,
  });
});

test("a caller that stops waiting ends its check as cancelled, and the values that arrive later change nothing", async () => {
  const { beacon, fake } = create();
  const controller = new AbortController();

  fake.hold();
  beacon.start();

  const pending = beacon.check({ signal: controller.signal });

  await vi.waitFor(() => expect(fake.calls.fetchAndActivate).toBe(1));

  controller.abort();

  await expect(pending).resolves.toMatchObject({
    support: { status: "cancelled" },
  });

  fake.release();
  await vi.waitFor(() => expect(fake.calls.network).toBe(1));

  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "not-checked",
    evaluation: null,
  });
});

test("a fetch that settles after dispose() changes nothing and throws nothing", async () => {
  const { beacon, fake } = create();

  fake.hold();
  beacon.start();

  const pending = beacon.check();

  await vi.waitFor(() => expect(fake.calls.fetchAndActivate).toBe(1));

  beacon.dispose();
  fake.release();

  await pending;
  await vi.waitFor(() => expect(fake.calls.network).toBe(1));

  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    evaluation: null,
  });
});

test("overlapping checks share one read of the SDK", async () => {
  const { beacon, fake } = create();

  beacon.start();

  await Promise.all([beacon.check(), beacon.check()]);

  expect(fake.calls.fetchAndActivate).toBe(1);
});

test("a scope replaced for another account forgets the verdict and asks the SDK again, which answers from its one cache", async () => {
  const { beacon, fake } = create();

  beacon.start();
  await beacon.check();

  expect(beacon.replaceScope({ ...SCOPE, partition: "alice" })).toEqual({
    status: "replaced",
  });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "not-checked",
  });

  await beacon.check();

  expect(fake.calls.fetchAndActivate).toBe(2);
  expect(fake.calls.network).toBe(1);
  expect(beacon.support.get()).toMatchObject({ status: "unsupported" });
});

test("a native build that cannot be read is unknown, never a build below the minimum", async () => {
  const { beacon } = create({ running: null });

  beacon.start();
  await beacon.check();

  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: null,
    evaluation: {
      status: "unknown",
      reasons: [{ code: "native-build-not-read", subject: "native" }],
    },
  });
});
