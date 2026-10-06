import type { ReleaseScope } from "@priemskiyyy/beacon";
import { testRunningReader } from "@priemskiyyy/beacon/testing";

import { deviceInfo } from "src/deviceInfo";
import { expoApplication } from "src/expoApplication";
import {
  fakeApplication,
  SCOPE as ANDROID_SCOPE,
} from "src/fakeApplication.fixture";
import { fakeDeviceInfo } from "src/fakeDeviceInfo.fixture";
import type { NativePlatform } from "src/types/NativePlatform";

const PLATFORMS: NativePlatform[] = ["android", "ios"];

for (const platform of PLATFORMS) {
  const scope: ReleaseScope = { ...ANDROID_SCOPE, platform };

  const createApplication = (
    facts: Parameters<typeof fakeApplication>[0] = {},
  ) => {
    const { application, reads } = fakeApplication(facts);

    return { reader: expoApplication({ application }), reads };
  };

  testRunningReader({
    name: `expo-application on ${platform}`,
    create: () => createApplication(),
    scope,
    situations: [
      {
        name: "the scope is a web application's",
        answers: "unknown",
        scope: { ...scope, platform: "web" },
        create: () => createApplication(),
      },
      {
        name: "the module gave no build number",
        answers: "unknown",
        create: () => createApplication({ build: null }),
      },
      {
        name: "the module gave no application id",
        answers: "unknown",
        create: () => createApplication({ applicationId: null }),
      },
      {
        name: "the binary is another application",
        answers: "unknown",
        create: () => createApplication({ applicationId: "host.exp.Exponent" }),
      },
      {
        name: "the module gave no marketing version",
        answers: "known",
        create: () => createApplication({ version: null }),
      },
    ],
  });

  const createDeviceInfo = (
    facts: Parameters<typeof fakeDeviceInfo>[0] = {},
  ) => {
    const { deviceInfo: sdk, reads, fail } = fakeDeviceInfo(facts);

    return { reader: deviceInfo({ deviceInfo: sdk }), reads, fail };
  };

  testRunningReader({
    name: `react-native-device-info on ${platform}`,
    create: () => createDeviceInfo(),
    scope,
    situations: [
      {
        name: "the scope is a web application's",
        answers: "unknown",
        scope: { ...scope, platform: "web" },
        create: () => createDeviceInfo(),
      },
      {
        name: "the library has no build number and answers unknown",
        answers: "unknown",
        create: () => createDeviceInfo({ build: "unknown" }),
      },
      {
        name: "the library has no bundle id and answers unknown",
        answers: "unknown",
        create: () => createDeviceInfo({ bundleId: "unknown" }),
      },
      {
        name: "the binary is another application",
        answers: "unknown",
        create: () => createDeviceInfo({ bundleId: "host.exp.Exponent" }),
      },
      {
        name: "a call of the library throws",
        answers: "rejection",
        create: () => {
          const fixture = createDeviceInfo();

          fixture.fail();

          return fixture;
        },
      },
    ],
  });
}
