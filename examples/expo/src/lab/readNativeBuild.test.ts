import { expect, test } from "vitest";

import { readNativeBuild } from "src/lab/readNativeBuild";

const APPLICATION = "dev.beacon.example";

const application = (
  overrides: Partial<{
    applicationId: string | null;
    nativeApplicationVersion: string | null;
    nativeBuildVersion: string | null;
  }> = {},
) => ({
  applicationId: APPLICATION,
  nativeApplicationVersion: "2.4.0",
  nativeBuildVersion: "108",
  ...overrides,
});

test("an Android build is named by its version code, under its application id, in the vocabulary of the Play adapter", () => {
  expect(readNativeBuild(application(), "android", APPLICATION)()).toEqual({
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
});

test("an iOS build is named by its build number, and its marketing version is the fact the App Store adapter reads", () => {
  expect(readNativeBuild(application(), "ios", APPLICATION)()).toEqual({
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

test("a build number the native module did not give is unknown, never a build named null", () => {
  for (const nativeBuildVersion of [null, "", "   "]) {
    expect(
      readNativeBuild(application({ nativeBuildVersion }), "ios", APPLICATION)()
        .identity,
    ).toEqual({ status: "unknown", reason: "native-build-not-read" });
  }
});

test("a build number is trimmed, so an identity with a space is not another build", () => {
  expect(
    readNativeBuild(
      application({ nativeBuildVersion: " 108 " }),
      "android",
      APPLICATION,
    )().identity,
  ).toMatchObject({ status: "known", value: "108" });
});

test("a binary of another application, such as Expo Go running this code, is unknown and never this application's build", () => {
  expect(
    readNativeBuild(
      application({ applicationId: "host.exp.Exponent" }),
      "ios",
      APPLICATION,
    )().identity,
  ).toEqual({ status: "unknown", reason: "another-application" });
  expect(
    readNativeBuild(application({ applicationId: null }), "ios", APPLICATION)()
      .identity,
  ).toEqual({ status: "unknown", reason: "another-application" });
});

test("what is read is what is reported when the marketing version is missing: no label", () => {
  expect(
    readNativeBuild(
      application({ nativeApplicationVersion: null }),
      "ios",
      APPLICATION,
    )(),
  ).toMatchObject({
    label: null,
    raw: { shortVersion: null, buildNumber: "108" },
  });
});
