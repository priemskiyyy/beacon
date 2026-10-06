// Typechecked, never run: the real `react-native-device-info` default export and
// module satisfy the structural type the reader uses, so Beacon never imports
// it at runtime, and a module that has no build number is refused by the
// compiler and not read as one.
import type { RunningReader, RunningReaders } from "@priemskiyyy/beacon";
import DeviceInfo from "react-native-device-info";
import * as DeviceInfoModule from "react-native-device-info";
import { expectTypeOf } from "vitest";

import { deviceInfo } from "src/deviceInfo";
import type { DeviceInfoLike } from "src/types/DeviceInfoLike";

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(DeviceInfo.getBuildNumber).toEqualTypeOf<() => string>();
expectTypeOf(DeviceInfo).toExtend<DeviceInfoLike>();
expectTypeOf(DeviceInfoModule).toExtend<DeviceInfoLike>();

// The platform and the authority are the scope's, so the library is all a reader needs.
export const native: RunningReaders["native"] = deviceInfo({
  deviceInfo: DeviceInfo,
});

export const reader: RunningReader<"native"> = native;

export const overridden = deviceInfo({
  deviceInfo: DeviceInfo,
  platform: "ios",
  authority: "com.example.notes",
  domain: "native-build",
});

export const fromModule = deviceInfo({ deviceInfo: DeviceInfoModule });

export const slots: RunningReaders = {
  native: reader,
  // @ts-expect-error -- the reader of the installed binary is made for the native subject, not the web build.
  web: reader,
};

// @ts-expect-error -- the library is the SDK's, not a random object.
deviceInfo({ deviceInfo: {} });

// @ts-expect-error -- the SDK is required: this adapter imports nothing itself.
deviceInfo({});

// @ts-expect-error -- a build is named for Android or iOS, so an override is one of them, and the scope's Platform.OS is what says anything else.
deviceInfo({ deviceInfo: DeviceInfo, platform: "web" });

// What a desktop shell's `app` offers: a version and a name, no build number or bundle id.
declare const versionOnly: { getVersion(): string; getName(): string };

// @ts-expect-error -- a library with a version and no build number is refused.
deviceInfo({ deviceInfo: versionOnly });
