import { Beacon } from "@priemskiyyy/beacon";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { createTestClock, settle } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { deviceInfo } from "src/deviceInfo";
import { APPLICATION, fakeDeviceInfo, SCOPE } from "src/fakeDeviceInfo.fixture";

const IOS_SCOPE: ReleaseScope = { ...SCOPE, platform: "ios" };

const read = (
  answers: Parameters<typeof fakeDeviceInfo>[0],
  options: Partial<Parameters<typeof deviceInfo>[0]> = {},
  scope: ReleaseScope = SCOPE,
) => {
  const { deviceInfo: sdk } = fakeDeviceInfo(answers);

  return deviceInfo({ deviceInfo: sdk, ...options })({ scope });
};

test("an Android build is named by its version code, and an iOS build by its build number, under the bundle id", async () => {
  await expect(read({})).resolves.toEqual({
    identity: {
      status: "known",
      authority: APPLICATION,
      domain: "android-version-code",
      value: "108",
    },
    label: "2.4.0",
    raw: {
      applicationId: APPLICATION,
      versionName: "2.4.0",
      versionCode: "108",
    },
  });
  await expect(read({}, {}, IOS_SCOPE)).resolves.toEqual({
    identity: {
      status: "known",
      authority: APPLICATION,
      domain: "ios-build",
      value: "108",
    },
    label: "2.4.0",
    raw: {
      applicationId: APPLICATION,
      shortVersion: "2.4.0",
      buildNumber: "108",
    },
  });
});

test("a platform given wins over the scope's, and the scope's says which numbers a build has", async () => {
  await expect(read({}, { platform: "ios" }, SCOPE)).resolves.toMatchObject({
    identity: { domain: "ios-build" },
  });
});

// Whatever else than the two stores a scope is for, such as a web application or a desktop shell, the library is not asked for a build number.
test("a scope that is not Android or iOS is unknown with the reason unsupported-platform, and the library is not asked", async () => {
  for (const platform of ["web", "macos", "windows", ""]) {
    const { deviceInfo: sdk, reads } = fakeDeviceInfo();

    const release = await deviceInfo({ deviceInfo: sdk })({
      scope: { ...SCOPE, platform },
    });

    expect(release).toEqual({
      identity: { status: "unknown", reason: "unsupported-platform" },
      label: null,
      raw: {},
    });
    expect(reads()).toBe(0);
  }
});

test("the library answers the text unknown where it has no value, and that is not a build", async () => {
  const release = await read({
    bundleId: "unknown",
    version: "unknown",
    build: "unknown",
  });

  expect(release).toEqual({
    identity: { status: "unknown", reason: "build-not-read" },
    label: null,
    raw: { applicationId: null, versionName: null, versionCode: null },
  });
});

test("a build the library could not read is unknown whatever else it read, and the marketing version stays", async () => {
  const release = await read({ build: "unknown" }, {}, IOS_SCOPE);

  expect(release).toEqual({
    identity: { status: "unknown", reason: "build-not-read" },
    label: "2.4.0",
    raw: {
      applicationId: APPLICATION,
      shortVersion: "2.4.0",
      buildNumber: null,
    },
  });
});

test("a bundle id the library could not read leaves no authority, so the build is unknown", async () => {
  const release = await read({ bundleId: "unknown" });

  expect(release.identity).toEqual({
    status: "unknown",
    reason: "application-not-read",
  });
});

test("an empty answer, and one of spaces, is not a value either, and a padded one is trimmed", async () => {
  await expect(read({ build: "  " })).resolves.toMatchObject({
    identity: { status: "unknown", reason: "build-not-read" },
  });
  await expect(read({ build: " 108 " })).resolves.toMatchObject({
    identity: { status: "known", value: "108" },
  });
});

test("a marketing version the library could not read is no label, and the build is still known", async () => {
  const release = await read({ version: "unknown" });

  expect(release.identity.status).toBe("known");
  expect(release.label).toBeNull();
});

test("a binary of another application, such as Expo Go running this code, is unknown, and none of its version numbers is kept", async () => {
  const release = await read(
    { bundleId: "host.exp.Exponent", version: "2.32.0", build: "1017" },
    {},
    IOS_SCOPE,
  );

  expect(release).toEqual({
    identity: { status: "unknown", reason: "another-application" },
    label: null,
    raw: { applicationId: "host.exp.Exponent" },
  });
});

test("the authority is the application of the scope unless one is given", async () => {
  await expect(
    read({}, {}, { ...SCOPE, application: "com.example.other" }),
  ).resolves.toMatchObject({
    identity: { status: "unknown", reason: "another-application" },
  });
  await expect(
    read({ bundleId: "host.exp.Exponent" }, { authority: "host.exp.Exponent" }),
  ).resolves.toMatchObject({
    identity: { status: "known", authority: "host.exp.Exponent" },
  });
});

test("creating the reader asks the library for nothing, and it is asked each time the reader runs", async () => {
  const { deviceInfo: sdk, answers, reads } = fakeDeviceInfo();
  const reader = deviceInfo({ deviceInfo: sdk });

  expect(reads()).toBe(0);

  await reader({ scope: SCOPE });
  answers.build = "109";

  await expect(reader({ scope: SCOPE })).resolves.toMatchObject({
    identity: { value: "109" },
  });
  expect(reads()).toBe(6);
});

test("a call that throws rejects the read, which is not a build and not an old one", async () => {
  const { deviceInfo: sdk, fail } = fakeDeviceInfo();

  fail();

  await expect(
    deviceInfo({ deviceInfo: sdk })({ scope: IOS_SCOPE }),
  ).rejects.toThrowError("The native module refused the call.");
});

test("an authority or a domain that is empty or has a space around it is refused when the reader is made, before anything is read", () => {
  const { deviceInfo: sdk, reads } = fakeDeviceInfo();

  for (const options of [{ authority: " " }, { domain: "" }]) {
    expect(() => deviceInfo({ deviceInfo: sdk, ...options })).toThrowError(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
    );
  }

  expect(reads()).toBe(0);
});

test("through a Beacon, a call that throws is a failed running fact, and one that answers is known", async () => {
  const create = (works: boolean) => {
    const { deviceInfo: sdk, fail } = fakeDeviceInfo();

    if (!works) {
      fail();
    }

    return new Beacon({
      scope: SCOPE,
      running: {
        boot: { id: "boot-1" },
        native: deviceInfo({ deviceInfo: sdk }),
      },
      routes: {},
      clock: createTestClock({ now: 1_000 }),
    });
  };

  const working = create(true);

  working.start();
  await settle();

  expect(working.running.get().native).toMatchObject({
    state: "known",
    release: { identity: { status: "known", value: "108" } },
  });

  const failing = create(false);

  failing.start();
  await settle();

  expect(failing.running.get().native).toMatchObject({
    state: "failed",
    error: { code: "RUNNING_READ_FAILED" },
  });
});
