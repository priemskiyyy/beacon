// Typechecked, never run: the real `expo-application` module satisfies the
// structural type the reader uses, so Beacon never imports it at runtime, and a
// module that is not the native constants is refused by the compiler and not
// read as a build.
import type { RunningReaders } from "@priemskiyyy/beacon";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as ConstantsModule from "expo-constants";
import { expectTypeOf } from "vitest";

import { expoApplication } from "src/expoApplication";
import type { ApplicationLike } from "src/types/ApplicationLike";
import type { NativeReaderOptions } from "src/types/NativeReaderOptions";

declare const sdk: typeof Application;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(sdk.nativeBuildVersion).toEqualTypeOf<string | null>();
expectTypeOf(sdk).toExtend<ApplicationLike>();

export const native: RunningReaders["native"] = expoApplication({
  application: Application,
  platform: "android",
  authority: "com.example.notes",
});

export const minimal = expoApplication({
  application: Application,
  platform: "ios",
});

// @ts-expect-error -- the module is the SDK's, not a random object.
expoApplication({ application: {}, platform: "android" });

// @ts-expect-error -- the SDK is required: this adapter imports nothing itself.
expoApplication({ platform: "android" });

// @ts-expect-error -- the platform decides how the build is named, so it is required.
expoApplication({ application: Application });

// @ts-expect-error -- a build is named for Android or iOS, and Platform.OS can say more than that.
expoApplication({ application: Application, platform: "web" });

// @ts-expect-error -- the default export of expo-constants reads the manifest, which an update can replace, and has no native build number.
expoApplication({ application: Constants, platform: "android" });

// @ts-expect-error -- the module of expo-constants has no build number either.
expoApplication({ application: ConstantsModule, platform: "android" });

// Its options are the ones every native reader takes.
expectTypeOf<
  Parameters<typeof expoApplication>[0]
>().toExtend<NativeReaderOptions>();
