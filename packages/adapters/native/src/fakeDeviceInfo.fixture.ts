import { APPLICATION } from "src/fakeApplication.fixture";
import type { DeviceInfoLike } from "src/types/DeviceInfoLike";

type Answers = { bundleId?: string; version?: string; build?: string };

// `react-native-device-info` as a test scripts it: calls that answer at once, the text `unknown` where a test gives it, and calls that throw where a test says so. The calls are counted.
export const fakeDeviceInfo = ({
  bundleId = APPLICATION,
  version = "2.4.0",
  build = "108",
}: Answers = {}) => {
  const answers = { bundleId, version, build };
  const state = { failing: false, reads: 0 };

  const ask = (answer: () => string) => {
    state.reads += 1;

    if (state.failing) {
      throw new Error("The native module refused the call.");
    }

    return answer();
  };

  const deviceInfo: DeviceInfoLike = {
    getBundleId: () => ask(() => answers.bundleId),
    getVersion: () => ask(() => answers.version),
    getBuildNumber: () => ask(() => answers.build),
  };

  return {
    deviceInfo,
    answers,
    reads: () => state.reads,
    fail: () => {
      state.failing = true;
    },
  };
};
