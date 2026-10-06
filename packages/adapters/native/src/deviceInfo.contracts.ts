// Typechecked, never run: the real `react-native-device-info` default export and
// module satisfy the structural type the reader uses, so Beacon never imports
// it at runtime, and a module that has no build number is refused by the
// compiler and not read as one.
import type { RunningReaders } from "@priemskiyyy/beacon";
import DeviceInfo from "react-native-device-info";
import * as DeviceInfoModule from "react-native-device-info";
import { expectTypeOf } from "vitest";

import { deviceInfo } from "src/deviceInfo";
import type { DeviceInfoLike } from "src/types/DeviceInfoLike";

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(DeviceInfo.getBuildNumber).toEqualTypeOf<() => string>();
expectTypeOf(DeviceInfo).toExtend<DeviceInfoLike>();
expectTypeOf(DeviceInfoModule).toExtend<DeviceInfoLike>();

export const native: RunningReaders["native"] = deviceInfo({
  deviceInfo: DeviceInfo,
  platform: "ios",
  authority: "com.example.notes",
});

export const fromModule = deviceInfo({
  deviceInfo: DeviceInfoModule,
  platform: "android",
});

// @ts-expect-error -- the library is the SDK's, not a random object.
deviceInfo({ deviceInfo: {}, platform: "android" });

// @ts-expect-error -- the SDK is required: this adapter imports nothing itself.
deviceInfo({ platform: "android" });

// @ts-expect-error -- the platform decides how the build is named, so it is required.
deviceInfo({ deviceInfo: DeviceInfo });

// What a desktop shell's `app` offers: a version and a name, no build number or bundle id.
declare const versionOnly: { getVersion(): string; getName(): string };

// @ts-expect-error -- a library with a version and no build number is refused.
deviceInfo({ deviceInfo: versionOnly, platform: "ios" });
