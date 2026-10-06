// Typechecked, never run: the real Remote Config SDKs satisfy the structural
// types the source uses, so Beacon never imports either at runtime, and the
// functions of one SDK cannot be given the instance of the other.
import type { ReleaseSource } from "@priemskiyyy/beacon";
import type * as NativeSdk from "@react-native-firebase/remote-config";
import type * as WebSdk from "firebase/remote-config";
import { expectTypeOf } from "vitest";

import { firebaseRemoteConfig } from "src/firebaseRemoteConfig";
import type { RemoteConfigLike } from "src/types/RemoteConfigLike";
import type { RemoteConfigModuleLike } from "src/types/RemoteConfigModuleLike";
import type { RemoteParameters } from "src/types/RemoteParameters";
import type { RemoteValueLike } from "src/types/RemoteValueLike";

declare const web: WebSdk.RemoteConfig;

declare const native: NativeSdk.RemoteConfig;

declare const webSdk: typeof WebSdk;

declare const nativeSdk: typeof NativeSdk;

// A module whose types did not resolve would be `any` and satisfy everything.
expectTypeOf(web.fetchTimeMillis).toEqualTypeOf<number>();
expectTypeOf(native.fetchTimeMillis).toEqualTypeOf<number>();
expectTypeOf(webSdk.getValue).parameter(0).toEqualTypeOf<WebSdk.RemoteConfig>();
expectTypeOf(nativeSdk.getValue)
  .parameter(0)
  .toEqualTypeOf<NativeSdk.RemoteConfig>();

expectTypeOf(web).toExtend<RemoteConfigLike>();
expectTypeOf(native).toExtend<RemoteConfigLike>();
expectTypeOf(webSdk).toExtend<RemoteConfigModuleLike<WebSdk.RemoteConfig>>();
expectTypeOf(nativeSdk).toExtend<
  RemoteConfigModuleLike<NativeSdk.RemoteConfig>
>();
expectTypeOf<WebSdk.Value>().toExtend<RemoteValueLike>();
expectTypeOf<NativeSdk.Value>().toExtend<RemoteValueLike>();

export const fromWeb: ReleaseSource<{ minimumBuild: string }> =
  firebaseRemoteConfig({
    remoteConfig: web,
    sdk: webSdk,
    document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
  });

export const fromNative: ReleaseSource<{ minimumBuild: string }> =
  firebaseRemoteConfig({
    remoteConfig: native,
    sdk: nativeSdk,
    document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
  });

// What `remote` and `source` answer is fixed, so a document cannot be built from a guess.
expectTypeOf<RemoteParameters["remote"]>().returns.toEqualTypeOf<string>();
expectTypeOf<RemoteParameters["source"]>().returns.toEqualTypeOf<
  "remote" | "default" | "missing"
>();

firebaseRemoteConfig({
  // @ts-expect-error -- the functions of one SDK take that SDK's instance, and the web module cannot read a native one.
  remoteConfig: native,
  sdk: webSdk,
  document: () => 1,
});

firebaseRemoteConfig({
  // @ts-expect-error -- the native module cannot read a web instance either.
  remoteConfig: web,
  sdk: nativeSdk,
  document: () => 1,
});

firebaseRemoteConfig({
  // @ts-expect-error -- a bare object is not the SDK's instance.
  remoteConfig: {},
  sdk: webSdk,
  document: () => 1,
});

// @ts-expect-error -- the document is built by the application, which alone knows what its parameters mean.
firebaseRemoteConfig({ remoteConfig: web, sdk: webSdk });

// @ts-expect-error -- the SDK is required: this source imports nothing itself.
firebaseRemoteConfig({ remoteConfig: web, document: () => 1 });

firebaseRemoteConfig({
  remoteConfig: web,
  sdk: webSdk,
  document: () => 1,
  // @ts-expect-error -- a failed fetch fails the read or uses what was activated, and nothing else.
  onFetchFailure: "ignore",
});

firebaseRemoteConfig({
  remoteConfig: web,
  sdk: webSdk,
  document: () => 1,
  // @ts-expect-error -- a duration is milliseconds, not text.
  maxAge: "12h",
});

firebaseRemoteConfig({
  remoteConfig: web,
  sdk: webSdk,
  // @ts-expect-error -- a key is text.
  document: ({ remote }) => remote(1),
});

firebaseRemoteConfig({
  remoteConfig: web,
  sdk: webSdk,
  document: ({ source }) => {
    // @ts-expect-error -- the SDK's own word for a key nothing defines is not one of the three a document sees.
    return source("minimum_build") === "static";
  },
});
