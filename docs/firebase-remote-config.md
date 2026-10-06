---
description: "Keep a minimum build in Firebase Remote Config and gate the app on it with a Beacon support policy, in React Native first and on the web: what a check reports, the expiry, and what the source never does."
---

# Firebase Remote Config

`@priemskiyyy/beacon-firebase-remote-config` makes Firebase Remote Config a [source](routes.md#sources). The canonical use is a forced upgrade: the minimum build is a parameter you change in the Firebase console, a [support policy](support.md) compares it with the build that runs, and a screen says when the app is too old. Beacon keeps that verdict beside its evidence, so a failed fetch never turns into a verdict.

The source builds your document from what the server sent, and never from anything else. A key that came from your application's defaults, a key nothing defines and a configuration that never fetched are not answers, and the read fails instead. A default of `0` read as a server's answer is the mistake this source exists to prevent: a check that fails on a missing key is honest, and one that answers "supported" from it is not.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-firebase-remote-config
```

You pass in the SDK you already use, and the adapter imports neither. In React Native that is `@react-native-firebase/remote-config`, which needs `@react-native-firebase/app` beside it. On the web it is `firebase`.

## The forced-upgrade recipe

This is the whole path in a React Native app, from the console to the screen. The web differs only in where the SDK comes from, and [says so below](#on-the-web).

### Set up Firebase

React Native Firebase is native code. In Expo it is not in Expo Go, so the app needs a development build or a release build, with the config plugin of `@react-native-firebase/app` in `plugins`; a bare app links it as any native module. Its own guide at [rnfirebase.io](https://rnfirebase.io/) has the steps for your Expo SDK and React Native version, and they are not repeated here. Beacon asks only for what comes out of it: a Remote Config instance and the module.

### Keep the minimum build in Remote Config

Add a parameter, `minimum_build`, with the lowest build the server still accepts, as a string: `"120"`. The Android version code and the iOS build number are the numbers it is compared with, so one parameter serves both platforms only when you number both the same way. Name two parameters when you do not.

A default you define for `minimum_build` in `defaultConfig` is the application's own text. It does no harm to other code that reads it, and the source refuses it as a server's answer.

### The source and the policy

```ts
// src/remoteConfig.ts
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import { integer } from "@priemskiyyy/beacon/versions";
import * as RemoteConfig from "@react-native-firebase/remote-config";

export const build = integer();

export const config = firebaseRemoteConfig({
  remoteConfig: RemoteConfig.getRemoteConfig(),
  sdk: RemoteConfig,
  document: ({ remote }) => ({
    minimumBuild: build.parse(remote("minimum_build")),
  }),
});
```

`integer()` is the parser, and it is the safe one. It rejects an empty text, whitespace, a sign, a fraction and `v120`, where `Number(text)` answers `0` for `""` and `NaN` for `"v120"`, and a `NaN` is never older than any build. A text it rejects fails the read with `INVALID_VERSION`, and support stays `unknown`.

The policy reads the native running fact, and accepts only a release named in the words of a native build, the two domains below:

```ts
// src/supportPolicy.ts
import { supportPolicy } from "@priemskiyyy/beacon";
import type { SupportVerdict } from "@priemskiyyy/beacon";

import { build, config } from "src/remoteConfig";

const NATIVE_DOMAINS = ["android-version-code", "ios-build"];

const unknown = (code: string): SupportVerdict<never> => ({
  status: "unknown",
  reasons: [{ code, subject: "native" }],
  remediation: [],
});

// No store route here: the screen below opens the store itself. Name a route in `remediation` when you have one.
export const minimumBuild = supportPolicy({
  source: config.select((document) => document.minimumBuild),
  evaluate: (minimum, running): SupportVerdict<never> => {
    const { native } = running;

    if (native.state !== "known") {
      return unknown("native-build-not-read");
    }

    const { identity } = native.release;

    if (
      identity.status !== "known" ||
      !NATIVE_DOMAINS.includes(identity.domain)
    ) {
      return unknown("native-build-unreadable");
    }

    if (build.compare(build.parse(identity.value), minimum) === "older") {
      return {
        status: "unsupported",
        reasons: [{ code: "native-build-too-old", subject: "native" }],
        remediation: [],
      };
    }

    return { status: "supported", reasons: [], remediation: [] };
  },
});
```

A native fact that is `pending`, `unconfigured` or `failed` is `unknown` here, never a build below the minimum. `integer()` takes whole numbers, which an Android version code always is and an iOS `CFBundleVersion` is when you number your builds with integers. A dotted iOS build number makes `build.parse` throw, and a policy that throws keeps the last valid evaluation in force and reports the failure in `error`.

### What the binary is

An Expo app reads the installed binary from `expo-application`, and a bare app from a library such as `react-native-device-info`. The release is named in the native words, or the policy above reads it as unknown: an Android build is `android-version-code` with the version code as text, an iOS build is `ios-build` with the build number as text, and the authority is the application id. [React Native](react-native.md#what-the-binary-is) explains each field; this is the reader for both platforms.

```ts
// src/nativeBuild.ts
import type { RunningRelease } from "@priemskiyyy/beacon";
import * as Application from "expo-application";
import { Platform } from "react-native";

const APPLICATION = "com.example.notes";

const readText = (value: string | null) => value?.trim() || null;

export const readNativeBuild = (): RunningRelease => {
  const build = readText(Application.nativeBuildVersion);
  const version = readText(Application.nativeApplicationVersion);

  if (Application.applicationId !== APPLICATION) {
    return {
      identity: { status: "unknown", reason: "another-application" },
      label: null,
      raw: { applicationId: Application.applicationId },
    };
  }

  if (build === null) {
    return {
      identity: { status: "unknown", reason: "native-build-not-read" },
      label: version,
      raw: { applicationId: APPLICATION },
    };
  }

  if (Platform.OS === "android") {
    return {
      identity: {
        status: "known",
        authority: APPLICATION,
        domain: "android-version-code",
        value: build,
      },
      label: version,
      raw: {
        applicationId: APPLICATION,
        versionName: version,
        versionCode: build,
      },
    };
  }

  return {
    identity: {
      status: "known",
      authority: APPLICATION,
      domain: "ios-build",
      value: build,
    },
    label: version,
    raw: {
      applicationId: APPLICATION,
      shortVersion: version,
      buildNumber: build,
    },
  };
};
```

### The Beacon

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { Platform } from "react-native";

import { readNativeBuild } from "src/nativeBuild";
import { minimumBuild } from "src/supportPolicy";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    distribution: Platform.OS === "ios" ? "app-store" : "google-play",
  },
  running: {
    // Hermes has no crypto.randomUUID. The id only has to differ between runtimes.
    boot: {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    },
    native: readNativeBuild,
  },
  routes: {},
  policy: minimumBuild,
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

The provider, the check on each return to the foreground and the reasons to keep the Beacon in a module of its own are in [React Native](react-native.md#set-up-the-beacon-once). This Beacon has no route, since the policy is the whole gate, and overlapping checks share one read.

### The screen

Show the gate for `unsupported` and for nothing else. `unknown` is not a verdict: it is what support is before the first answer, while the device is offline and after the evidence lapsed, and a user should not be locked out of the app for that. See [support](support.md#when-support-ends).

```tsx
// src/SupportGate.tsx
import { useBeacon, useSupport } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button, Linking, Text, View } from "react-native";

const STORE_URL = "https://example.com/get-the-app";

export const SupportGate = ({ children }: { children: ReactNode }) => {
  const beacon = useBeacon();
  const status = useSupport(({ status }) => status);

  useEffect(() => {
    beacon.check({ reason: "startup" });
  }, [beacon]);

  if (status !== "unsupported") {
    return <>{children}</>;
  }

  return (
    <View accessibilityRole="alert">
      <Text>This version of the app is no longer supported.</Text>
      <Button title="Update" onPress={() => Linking.openURL(STORE_URL)} />
      <Button
        title="Check again"
        onPress={() => beacon.check({ reason: "manual" })}
      />
    </View>
  );
};
```

```tsx
// src/App.tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { Text } from "react-native";

import { beacon } from "src/beacon";
import { SupportGate } from "src/SupportGate";

export const App = () => (
  <BeaconProvider beacon={beacon} start>
    <SupportGate>
      <Text>Notes</Text>
    </SupportGate>
  </BeaconProvider>
);
```

A check runs when the gate mounts, and that is a fetch of Remote Config when the last one is older than the interval. To check again each time the app returns to the foreground, use the hook in [React Native](react-native.md#when-to-check).

## What a check reports

A read calls `ensureInitialized`, then `fetchAndActivate`, then reads the values it needs, all on the instance and the module you passed in. The fetch is the source's own, so that the time of the last fetch dates the values it activated. The answer is the document your builder made and an expiry, with no revision, digest or issuer, since Firebase exposes no template version and none is made up.

### What the SDK says about a key

`getValue(key).getSource()` is the provenance the source relies on. `document` reads it through `source(key)`, and `remote(key)` refuses everything but the server's.

| `getSource()`                    | `source(key)` | `remote(key)`                               | Means                                                        |
| -------------------------------- | ------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `remote`                         | `remote`      | the text, an empty text included            | the server sent it and the SDK activated it                  |
| `default`                        | `default`     | throws, the read fails with `SOURCE_FAILED` | your `defaultConfig` or a defaults resource                  |
| `static`                         | `missing`     | throws, the read fails with `SOURCE_FAILED` | nothing defines the key, and its text is empty               |
| anything else, such as `unknown` | `missing`     | throws, the read fails with `SOURCE_FAILED` | the iOS module answers `unknown` for a source it cannot name |

A document that accepts a default on purpose reads `source(key)` and decides. Nothing in the source ever does it for you.

### What the check says

| The SDK                                          | The check                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| fetches and activates                            | `succeeded`, the verdict is fresh until the fetch that got the values is `maxAge` old, which is the interval by default                                            |
| answers from its cache, inside the interval      | `succeeded`, and the evidence keeps the time of the fetch that got the values, so it is never fresher than the server said                                         |
| rejects the fetch, in `fail` mode                | `failed` with what the SDK threw, and the last verdict stays and ages on its own clock                                                                             |
| rejects the fetch, in `use-activated` mode       | `succeeded`, and the evidence is dated by the old fetch: the support verdict is `unknown` with the reason `expired`, and the evaluation it reached stays beside it |
| has never fetched                                | `failed` with `SOURCE_FAILED`, in either mode                                                                                                                      |
| cannot initialize                                | `failed`, in either mode                                                                                                                                           |
| has no server value for a key your builder reads | `failed` with `SOURCE_FAILED`, and support stays `unknown`                                                                                                         |

### Fail and use-activated

`onFetchFailure` is `"fail"` by default: a fetch that fails fails the read, the last verdict stays, and on a cold start offline there is none, so support is `unknown`.

`"use-activated"` answers with the values the SDK activated in an earlier run, dated by the fetch that got them. The check then says `succeeded`, although the server did not answer. That is what the option is for, and it is the one place a check succeeds without an authority answering, so the evidence is what to read: a verdict from values activated two days ago is `expired`, and support is `unknown` with the evaluation kept beside it. A `maxAge` longer than the age of the values makes them `fresh`: then the verdict is yours, for as long as you said.

```ts
// src/offlineRemoteConfig.ts
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import * as RemoteConfig from "@react-native-firebase/remote-config";

// Good for two days after the fetch that got it, server or no server.
export const config = firebaseRemoteConfig({
  remoteConfig: RemoteConfig.getRemoteConfig(),
  sdk: RemoteConfig,
  document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
  onFetchFailure: "use-activated",
  maxAge: 48 * 3_600_000,
});
```

Without a fetch that ever succeeded there is nothing to use: a configuration that never fetched fails the read whichever the mode.

## Expiry and throttling

The evidence expires at `fetchTimeMillis + (maxAge ?? minimumFetchIntervalMillis)`. `fetchTimeMillis` is when the SDK last reached the server, and the minimum fetch interval, 12 hours unless your app sets another, is how long the SDK answers from its cache without asking. So the expiry is the moment the SDK would next go to the network. Both numbers are epoch time on the device, which is the clock Beacon reads too, so a device with a wrong clock shifts both.

- **A check inside the interval costs nothing.** The SDK answers from its cache, with no request and no new time, and the source answers with the time of the fetch that got the values.
- **A check after the interval fetches.** The new time starts a new interval.
- **A `maxAge` shorter than the interval cannot make the SDK fetch sooner.** The answer expires at `maxAge`, and stays expired until the interval lapses and the next check reaches the server. To refresh sooner, lower the SDK's own interval.
- **Throttling is the SDK's.** When it refuses a fetch it rejects, and the mode decides what that means. The source adds no retry and no backoff: Beacon has no scheduler, and your check is the retry.
- **Before any fetch** `fetchTimeMillis` is -1 on the web and on Android, and 0 on iOS. Only a time above zero dates a value, so both mean the same.

### The interval in a debug build

A debug build often sets the interval to 0, so that every fetch reaches the server. Then the expiry is the fetch time itself: every answer is stale on arrival, and support is `unknown` with the reason `expired` even right after a successful fetch. Pass a `maxAge`:

```ts
// src/debugRemoteConfig.ts
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import * as RemoteConfig from "@react-native-firebase/remote-config";

const remoteConfig = RemoteConfig.getRemoteConfig();

// Your app's setting, not the source's: assign the whole object, since React Native Firebase's getter answers a new one each time.
remoteConfig.settings = {
  minimumFetchIntervalMillis: 0,
  fetchTimeoutMillis: 60_000,
};

export const config = firebaseRemoteConfig({
  remoteConfig,
  sdk: RemoteConfig,
  document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
  maxAge: 3_600_000,
});
```

### A fetch that is slower than a check

A fetch cannot be aborted: neither SDK takes a signal. Beacon's check gives up after 10 seconds, and Firebase's fetch timeout is 60, so on a bad connection the check fails with `SOURCE_TIMEOUT` while the fetch goes on. If it finishes, it activates its values after the check gave up, and the next check finds them with no new request. Raise `timeouts.check` of the Beacon if you would rather wait for it, knowing that a check then takes as long as the SDK does.

## On the web

The same source over the web SDK. The instance comes from `getRemoteConfig(app)` and the module is `firebase/remote-config`:

```ts
// src/remoteConfig.web.ts
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import { integer } from "@priemskiyyy/beacon/versions";
import { initializeApp } from "firebase/app";
import * as RemoteConfig from "firebase/remote-config";

const build = integer();

const app = initializeApp({
  apiKey: "your-api-key",
  projectId: "your-project",
  appId: "your-app-id",
});

export const config = firebaseRemoteConfig({
  remoteConfig: RemoteConfig.getRemoteConfig(app),
  sdk: RemoteConfig,
  document: ({ remote }) => ({
    minimumBuild: build.parse(remote("minimum_build")),
  }),
});
```

The instance and the module have to be the same SDK's, and the types refuse a web module with a native instance. The web SDK keeps its activated values and its fetch time in IndexedDB. Where IndexedDB is missing, `isSupported()` says `false` and the SDK's fetch rejects, so the read fails like any failed fetch.

What a web gate compares is yours to say. A web build is named under the domain `web-artifact`, and its value is usually a hash with no order, so keep a number of your own, or a list of denied builds as [the standard manifest](http.md#the-manifest) does, in a parameter, and write the policy's comparison for that.

## Real-time updates

The source observes nothing: it does not call `onConfigUpdate`, and subscribing is not neutral, since a listener keeps a connection to Firebase open for as long as it lives. To have a change on the server reach the gate when it happens, subscribe in your application, activate the new template and check:

```ts
// src/watchRemoteConfig.ts
import * as RemoteConfig from "@react-native-firebase/remote-config";

import { beacon } from "src/beacon";

export const watchRemoteConfig = (remoteConfig: RemoteConfig.RemoteConfig) =>
  RemoteConfig.onConfigUpdate(remoteConfig, {
    next: async () => {
      try {
        await RemoteConfig.activate(remoteConfig);
        await beacon.check({ reason: "invalidation" });
      } catch {
        // The next check reads what the SDK holds.
      }
    },
    error: () => {},
    complete: () => {},
  });
```

It returns the function that removes the listener. The check that follows finds the values the listener activated, and asks the server for nothing while the interval holds. No device has run this recipe.

## What it does not do

- **It does not configure the SDK.** The defaults, the fetch settings and the custom signals stay your application's, and the source never sets one.
- **It does not choose when values activate.** A read fetches and activates for the whole application, so a screen that reads the same SDK sees the new values from then on. An application that activates on its own schedule writes its own source with `createReleaseSource`: it is about ten lines over the same three SDK functions.
- **It does not observe real-time updates.** See above.
- **It does not partition by account.** Remote Config's cache belongs to the installation, and a fetch inside the interval is answered from it whoever signed in since. [`scope.partition`](scopes.md) makes Beacon forget the last account's answer when the scope is replaced, and the next read asks the SDK again, which may answer from that same cache. A gate that must differ by account does not belong in Remote Config.
- **It does not name a revision.** Firebase keeps the template version to itself, so the evidence has none, and two different templates are told apart only by their values.
- **It does not vouch for values older than their fetch.** With `use-activated` the values are dated by the last successful fetch. That is when they were activated only if everything that fetches also activates: a fetch your code makes without activating moves the time forward and leaves the old values in place.

What no device has run is in the [package's verification table](https://github.com/priemskiyyy/beacon/tree/main/packages/adapters/firebase-remote-config#verification): the native fetch, the iOS fetch time of 0, throttling, how activation reaches the screens and the Expo development build.

## Testing

The source takes the SDK as an argument, so a test passes an object of the same shape. `ensureInitialized`, `fetchAndActivate` and `getValue` are the three functions it calls, and the instance needs `fetchTimeMillis` and `settings.minimumFetchIntervalMillis`:

```ts
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { firebaseRemoteConfig } from "@priemskiyyy/beacon-firebase-remote-config";
import type {
  RemoteConfigLike,
  RemoteConfigModuleLike,
} from "@priemskiyyy/beacon-firebase-remote-config";
import { expect, test } from "vitest";

const clock = createTestClock({ now: 1_790_000_000_000 });

const remoteConfig: RemoteConfigLike = {
  fetchTimeMillis: clock.now(),
  settings: { minimumFetchIntervalMillis: 43_200_000 },
};

const sdk: RemoteConfigModuleLike<RemoteConfigLike> = {
  ensureInitialized: async () => {},
  fetchAndActivate: async () => true,
  getValue: (_, key) => ({
    asString: () => "120",
    getSource: () => (key === "minimum_build" ? "remote" : "static"),
  }),
};

test("the minimum build is the server's text, good until the interval lapses", async () => {
  const config = firebaseRemoteConfig({
    remoteConfig,
    sdk,
    document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
  });

  const answer = await config.read({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "android",
      distribution: "google-play",
    },
    signal: new AbortController().signal,
    attempt: 1,
  });

  expect(answer).toEqual({
    document: { minimumBuild: "120" },
    expiresAt: clock.now() + 43_200_000,
  });
});
```

A fake like this one proves how Beacon maps what the SDK says. It does not prove what a device's Remote Config answers: see [limits](limits.md#what-a-test-proves) and [testing](testing.md#faking-a-provider). The package's own tests run the source through a real Beacon against a fake that keeps the cache behavior of the web SDK, and the conformance suite of [custom adapters](custom-adapters.md#prove-it) runs over it.
