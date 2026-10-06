import { testRunningReader } from "@priemskiyyy/beacon/testing";

import { deviceInfo } from "src/deviceInfo";
import { expoApplication } from "src/expoApplication";
import { APPLICATION, fakeApplication } from "src/fakeApplication.fixture";
import { fakeDeviceInfo } from "src/fakeDeviceInfo.fixture";
import type { NativePlatform } from "src/types/NativePlatform";

const PLATFORMS: NativePlatform[] = ["android", "ios"];

for (const platform of PLATFORMS) {
  const createApplication = (
    facts: Parameters<typeof fakeApplication>[0] = {},
  ) => {
    const { application, reads } = fakeApplication(facts);

    return {
      reader: expoApplication({
        application,
        platform,
        authority: APPLICATION,
      }),
      reads,
    };
  };

  testRunningReader({
    name: `expo-application on ${platform}`,
    create: () => createApplication(),
    situations: [
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

    return {
      reader: deviceInfo({ deviceInfo: sdk, platform, authority: APPLICATION }),
      reads,
      fail,
    };
  };

  testRunningReader({
    name: `react-native-device-info on ${platform}`,
    create: () => createDeviceInfo(),
    situations: [
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
