// Typechecked, never run: the real `expo-application` module satisfies the
// structural type the reader uses, so Beacon never imports it at runtime, and a
// module that is not the native constants is refused by the compiler and not
// read as a build.
import type { RunningReader, RunningReaders } from "@priemskiyyy/beacon";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as ConstantsModule from "expo-constants";
import { expectTypeOf } from "vitest";

import { expoApplication } from "src/expoApplication";
import type { ApplicationLike } from "src/types/ApplicationLike";

declare const sdk: typeof Application;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(sdk.nativeBuildVersion).toEqualTypeOf<string | null>();
expectTypeOf(sdk).toExtend<ApplicationLike>();

// The platform and the authority are the scope's, so the module is all a reader needs.
export const native: RunningReaders["native"] = expoApplication({
  application: Application,
});

export const reader: RunningReader<"native"> = native;

export const overridden = expoApplication({
  application: Application,
  platform: "ios",
  authority: "com.example.notes",
  domain: "native-build",
});

export const slots: RunningReaders = {
  native: reader,
  // @ts-expect-error -- the reader of the installed binary is made for the native subject, not the bundle.
  bundle: reader,
};

// @ts-expect-error -- the module is the SDK's, not a random object.
expoApplication({ application: {} });

// @ts-expect-error -- the SDK is required: this adapter imports nothing itself.
expoApplication({});

// @ts-expect-error -- a build is named for Android or iOS, so an override is one of them, and the scope's Platform.OS is what says anything else.
expoApplication({ application: Application, platform: "web" });

// @ts-expect-error -- the default export of expo-constants reads the manifest, which an update can replace, and has no native build number.
expoApplication({ application: Constants });

// @ts-expect-error -- the module of expo-constants has no build number either.
expoApplication({ application: ConstantsModule });
