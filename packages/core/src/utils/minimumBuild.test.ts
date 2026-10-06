import { expect, test } from "vitest";

import { createMockSource } from "src/mock/createMockSource";
import { settle } from "src/mock/settle";
import type { RunningRelease } from "src/types/RunningRelease";
import type { SupportPolicy } from "src/types/SupportPolicy";
import { createRoutedBeacon } from "src/utils/Beacon.fixture";
import { DEFAULT_RUNNING_TIMEOUT } from "src/utils/constants/defaults";
import {
  ANDROID_VERSION_CODE_DOMAIN,
  IOS_BUILD_DOMAIN,
  WEB_ARTIFACT_DOMAIN,
} from "src/utils/constants/domains";
import { createFakeDriver } from "src/utils/drivers.fixture";
import { minimumBuild } from "src/utils/minimumBuild";
import { buildNativeRelease } from "src/utils/policy.fixture";

type Config = { minimum: string | number };

const APPLICATION = "com.example.notes";

const buildIosRelease = (build: string): RunningRelease => ({
  identity: {
    status: "known",
    authority: APPLICATION,
    domain: IOS_BUILD_DOMAIN,
    value: build,
  },
  label: "2.4.0",
  raw: {
    applicationId: APPLICATION,
    shortVersion: "2.4.0",
    buildNumber: build,
  },
});

const createConfigSource = () => createMockSource<Config>({ name: "config" });

type Source = ReturnType<typeof createConfigSource>;

// A Beacon over one store route, the forced-upgrade policy and one configuration answer, checked once.
const check = async ({
  policy,
  mock,
  native,
  minimum,
  hold = false,
}: {
  hold?: boolean;
  policy: (source: Source) => SupportPolicy<Config, string, "store">;
  mock: Source;
  native: () => RunningRelease | Promise<RunningRelease>;
  minimum: string | number;
}) => {
  const { route } = createFakeDriver();

  const { beacon, clock } = createRoutedBeacon(
    { store: route },
    { running: { native }, policy: policy(mock) },
  );

  beacon.start();

  const checking = beacon.check();

  await settle();

  // A reader that never answers is a failed fact once its time is up, and the source is read after that.
  if (hold) {
    clock.advance(DEFAULT_RUNNING_TIMEOUT);
    await settle();
  }

  mock.resolve({ document: { minimum }, expiresAt: 601_000 });
  await checking;

  return beacon.support.get();
};

const run = (
  policy: (source: Source) => SupportPolicy<Config, string, "store">,
  native: () => RunningRelease | Promise<RunningRelease>,
  minimum: string | number,
  hold = false,
) => check({ policy, mock: createConfigSource(), native, minimum, hold });

const withStore = (source: Source) =>
  minimumBuild({
    source: source.source.select((config) => config.minimum),
    remediation: "store",
  });

test("an Android build below the minimum is unsupported, and names the store route that sends it there", async () => {
  const support = await run(withStore, () => buildNativeRelease(100), 108);

  expect(support).toMatchObject({
    status: "unsupported",
    reason: null,
    evaluation: {
      reasons: [{ code: "native-build-too-old", subject: "native" }],
      remediation: [{ route: "store", level: "required" }],
    },
  });
});

test("a build at the minimum or above it is supported, however the minimum is written", async () => {
  await expect(
    run(withStore, () => buildNativeRelease(108), 108),
  ).resolves.toMatchObject({
    status: "supported",
    evaluation: { reasons: [], remediation: [] },
  });
  await expect(
    run(withStore, () => buildNativeRelease(120), "108"),
  ).resolves.toMatchObject({
    status: "supported",
  });
});

test("an iOS build is read from its identity, which the raw values of Android are not part of", async () => {
  const older = await run(withStore, () => buildIosRelease("120"), "130");
  const current = await run(withStore, () => buildIosRelease("130"), 130);

  expect(older).toMatchObject({
    status: "unsupported",
    evaluation: { reasons: [{ code: "native-build-too-old" }] },
  });
  expect(current).toMatchObject({ status: "supported" });
});

test("a build that has not been read is unknown, never too old and never supported", async () => {
  const held = await run(
    withStore,
    () => new Promise<RunningRelease>(() => {}),
    108,
    true,
  );

  const failed = await run(
    withStore,
    () => Promise.reject(new Error("The module is gone.")),
    108,
  );

  for (const support of [held, failed]) {
    expect(support).toMatchObject({
      status: "unknown",
      reason: null,
      evaluation: {
        reasons: [{ code: "native-build-not-read", subject: "native" }],
        remediation: [],
      },
    });
  }
});

test("a build that names nothing a minimum could compare with is unknown as unreadable", async () => {
  const unknown = await run(
    withStore,
    () => ({
      identity: { status: "unknown", reason: "another-application" },
      label: null,
      raw: {},
    }),
    108,
  );

  const web = await run(
    withStore,
    () => ({
      identity: {
        status: "known",
        authority: APPLICATION,
        domain: WEB_ARTIFACT_DOMAIN,
        value: "100",
      },
      label: null,
      raw: {},
    }),
    108,
  );

  for (const support of [unknown, web]) {
    expect(support).toMatchObject({
      status: "unknown",
      evaluation: {
        reasons: [{ code: "native-build-unreadable", subject: "native" }],
      },
    });
  }
});

test("a build of another authority is unreadable when the application names its own, and compared as it is when it does not", async () => {
  const other: RunningRelease = {
    identity: {
      status: "known",
      authority: "host.exp.Exponent",
      domain: ANDROID_VERSION_CODE_DOMAIN,
      value: "1",
    },
    label: null,
    raw: {},
  };

  const named = await run(
    (source) =>
      minimumBuild({
        source: source.source.select((config) => config.minimum),
        authority: APPLICATION,
      }),
    () => other,
    108,
  );

  const unnamed = await run(withStore, () => other, 108);

  expect(named).toMatchObject({
    status: "unknown",
    evaluation: { reasons: [{ code: "native-build-unreadable" }] },
  });
  expect(unnamed).toMatchObject({ status: "unsupported" });
});

test("a recommended remediation is offered at the level the application chose, and no route means none", async () => {
  const recommended = await run(
    (source) =>
      minimumBuild({
        source: source.source.select((config) => config.minimum),
        remediation: "store",
        level: "recommended",
      }),
    () => buildNativeRelease(100),
    108,
  );

  const bare = await check({
    policy: (source) =>
      minimumBuild({
        source: source.source.select((config) => config.minimum),
      }),
    mock: createConfigSource(),
    native: () => buildNativeRelease(100),
    minimum: 108,
  });

  expect(recommended).toMatchObject({
    status: "unsupported",
    evaluation: { remediation: [{ route: "store", level: "recommended" }] },
  });
  expect(bare).toMatchObject({
    status: "unsupported",
    evaluation: { remediation: [] },
  });
});

test.each(["1.2.0", "", " 108", "v108", "-1", "108.5"])(
  "a minimum of %j is not a whole number, so the policy fails with INVALID_VERSION and support stays unknown",
  async (minimum) => {
    const support = await run(
      withStore,
      () => buildNativeRelease(100),
      minimum,
    );

    expect(support).toMatchObject({
      status: "unknown",
      reason: "evaluation-failed",
      evaluation: null,
      error: { code: "INVALID_VERSION" },
    });
  },
);

test("a dotted build number of the binary fails the policy too, and never reads as a number", async () => {
  const support = await run(withStore, () => buildIosRelease("1.2.0"), 108);

  expect(support).toMatchObject({
    status: "unknown",
    reason: "evaluation-failed",
    error: { code: "INVALID_VERSION" },
  });
});

test("a minimum that is malformed fails the policy even while the build is not read yet", async () => {
  const support = await run(
    withStore,
    () => new Promise<RunningRelease>(() => {}),
    "1.2.0",
    true,
  );

  expect(support).toMatchObject({
    status: "unknown",
    reason: "evaluation-failed",
    error: { code: "INVALID_VERSION" },
  });
});

test("the domain words are the ones the adapters name their builds in", () => {
  expect([
    ANDROID_VERSION_CODE_DOMAIN,
    IOS_BUILD_DOMAIN,
    WEB_ARTIFACT_DOMAIN,
  ]).toEqual(["android-version-code", "ios-build", "web-artifact"]);
});
