import { Beacon } from "@priemskiyyy/beacon";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { createTestClock, settle } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { expoApplication } from "src/expoApplication";
import {
  APPLICATION,
  fakeApplication,
  SCOPE,
} from "src/fakeApplication.fixture";

const IOS_SCOPE: ReleaseScope = { ...SCOPE, platform: "ios" };

const read = async (
  facts: Parameters<typeof fakeApplication>[0],
  options: Partial<Parameters<typeof expoApplication>[0]> = {},
  scope: ReleaseScope = SCOPE,
) => {
  const { application } = fakeApplication(facts);

  return expoApplication({ application, ...options })({ scope });
};

test("an Android build is named by its version code, under its application id, in the words the Play adapter offers in", async () => {
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
});

test("an iOS build is named by its build number, and its marketing version is the fact the App Store adapter reads", async () => {
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

test("the platform comes from the scope of the read, and Platform.OS is what a scope says", async () => {
  await expect(read({}, {}, IOS_SCOPE)).resolves.toMatchObject({
    identity: { domain: "ios-build" },
  });
  await expect(read({}, {}, SCOPE)).resolves.toMatchObject({
    identity: { domain: "android-version-code" },
  });
});

test("a platform given wins over the scope's", async () => {
  await expect(read({}, { platform: "ios" }, SCOPE)).resolves.toMatchObject({
    identity: { domain: "ios-build" },
    raw: { shortVersion: "2.4.0", buildNumber: "108" },
  });
});

// A scope of a web application, a desktop shell or anything else than the two stores has no build number of this kind, and the module is not asked.
test("a scope that is not Android or iOS is unknown with the reason unsupported-platform, and the module is not asked", async () => {
  for (const platform of ["web", "macos", "windows", ""]) {
    const { application, reads } = fakeApplication();

    const release = await expoApplication({ application })({
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

test("a platform given is read whatever the scope says, so a web scope can still name an iOS binary", async () => {
  await expect(
    read({}, { platform: "ios" }, { ...SCOPE, platform: "web" }),
  ).resolves.toMatchObject({
    identity: { status: "known", domain: "ios-build" },
  });
});

test("the domain is the application's to name, for a manifest that calls its builds something else", async () => {
  const { identity } = await read({}, { domain: "native-build" });

  expect(identity).toMatchObject({ status: "known", domain: "native-build" });
});

test("a value is text with no space around it, so a padded build is the same build", async () => {
  const { identity, label, raw } = await read({
    applicationId: " com.example.notes ",
    version: " 2.4.0\n",
    build: " 108 ",
  });

  expect(identity).toEqual({
    status: "known",
    authority: APPLICATION,
    domain: "android-version-code",
    value: "108",
  });
  expect(label).toBe("2.4.0");
  expect(raw).toMatchObject({
    applicationId: APPLICATION,
    versionName: "2.4.0",
    versionCode: "108",
  });
});

test("a build number the module did not give is unknown, never a build named null, and the marketing version stays", async () => {
  for (const build of [null, "", "   "]) {
    const release = await read({ build }, {}, IOS_SCOPE);

    expect(release).toEqual({
      identity: { status: "unknown", reason: "build-not-read" },
      label: "2.4.0",
      raw: {
        applicationId: APPLICATION,
        shortVersion: "2.4.0",
        buildNumber: null,
      },
    });
  }
});

test("an application id the module did not give leaves no authority to name the build under, so it is unknown", async () => {
  for (const applicationId of [null, "", "  "]) {
    const release = await read({ applicationId });

    expect(release).toEqual({
      identity: { status: "unknown", reason: "application-not-read" },
      label: "2.4.0",
      raw: { applicationId: null, versionName: "2.4.0", versionCode: "108" },
    });
  }
});

test("a module that gave neither is unknown for its build, the fact the journal needs first", async () => {
  const release = await read({ applicationId: null, build: null });

  expect(release.identity).toEqual({
    status: "unknown",
    reason: "build-not-read",
  });
});

test("a binary that gave no marketing version has no label, and is still a known build", async () => {
  const release = await read({ version: null }, {}, IOS_SCOPE);

  expect(release.identity.status).toBe("known");
  expect(release.label).toBeNull();
  expect(release.raw).toMatchObject({ shortVersion: null, buildNumber: "108" });
});

test("a binary of another application, such as Expo Go running this code, is unknown, and none of its version numbers is kept", async () => {
  const release = await read(
    { applicationId: "host.exp.Exponent", version: "2.32.0", build: "1017" },
    {},
    IOS_SCOPE,
  );

  expect(release).toEqual({
    identity: { status: "unknown", reason: "another-application" },
    label: null,
    raw: { applicationId: "host.exp.Exponent" },
  });
});

test("the authority is the application of the scope, and a scope of another application makes this binary another application", async () => {
  await expect(
    read({}, {}, { ...SCOPE, application: "com.example.other" }),
  ).resolves.toMatchObject({
    identity: { status: "unknown", reason: "another-application" },
  });
});

test("an authority given is the one a binary is checked against, instead of the scope's application", async () => {
  const release = await read(
    { applicationId: "host.exp.Exponent" },
    { authority: "host.exp.Exponent" },
  );

  expect(release.identity).toMatchObject({
    status: "known",
    authority: "host.exp.Exponent",
  });
  await expect(
    read({}, { authority: "host.exp.Exponent" }),
  ).resolves.toMatchObject({
    identity: { status: "unknown", reason: "another-application" },
  });
});

test("the authority is compared with the application id as text with no space around it", async () => {
  const release = await read(
    { applicationId: ` ${APPLICATION}` },
    { authority: APPLICATION },
  );

  expect(release.identity).toMatchObject({
    status: "known",
    authority: APPLICATION,
  });
});

test("an authority the binary does not report, when the module gave no id at all, is an id nobody read and not another application", async () => {
  const release = await read(
    { applicationId: null },
    { authority: APPLICATION },
  );

  expect(release.identity).toEqual({
    status: "unknown",
    reason: "application-not-read",
  });
});

test("creating the reader reads nothing, and the constants are read when the reader runs", async () => {
  const { application, facts, reads } = fakeApplication();

  const reader = expoApplication({ application });

  expect(reads()).toBe(0);

  facts.build = "109";

  await expect(
    Promise.resolve(reader({ scope: SCOPE })),
  ).resolves.toMatchObject({
    identity: { value: "109" },
  });
  expect(reads()).toBeGreaterThan(0);
});

test("an authority or a domain that is empty or has a space around it is refused when the reader is made, before anything is read", () => {
  const { application, reads } = fakeApplication();

  for (const options of [
    { authority: "" },
    { authority: " com.example.notes" },
    { domain: "" },
    { domain: "ios-build " },
  ]) {
    expect(() => expoApplication({ application, ...options })).toThrowError(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
    );
  }

  expect(reads()).toBe(0);
});

test("the running fact of the native subject is known once the session reads it, and Expo Go's is not this application's", async () => {
  const create = (applicationId: string) => {
    const { application } = fakeApplication({ applicationId });

    return new Beacon({
      scope: SCOPE,
      running: {
        boot: { id: "boot-1" },
        native: expoApplication({ application }),
      },
      routes: {},
      clock: createTestClock({ now: 1_000 }),
    });
  };

  const own = create(APPLICATION);

  expect(own.running.get().native.state).toBe("pending");

  own.start();
  await settle();

  expect(own.running.get().native).toMatchObject({
    state: "known",
    release: {
      identity: { status: "known", authority: APPLICATION, value: "108" },
    },
  });

  const expoGo = create("host.exp.Exponent");

  expoGo.start();
  await settle();

  expect(expoGo.running.get().native).toMatchObject({
    state: "known",
    release: { identity: { status: "unknown", reason: "another-application" } },
  });
});

test("after replaceScope the next read names the binary under the platform of the new scope", async () => {
  const { application } = fakeApplication();

  const beacon = new Beacon({
    scope: SCOPE,
    running: { native: expoApplication({ application }) },
    routes: {},
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();
  await settle();

  expect(beacon.running.get().native).toMatchObject({
    release: { identity: { domain: "android-version-code" } },
  });

  beacon.replaceScope(IOS_SCOPE);
  await settle();

  expect(beacon.running.get().native).toMatchObject({
    release: { identity: { domain: "ios-build" } },
  });
});
