---
description: "Use Beacon in a React Native or Expo app: the engine and toolchain it needs, a boot id without crypto, the provider, Fast Refresh and Strict Mode, checks on foreground, what a reload keeps, guarding unsaved input, and what no device has run."
---

# React Native

Beacon runs in a React Native app on Hermes, the engine of React Native, on iOS and Android, with Expo or without it. This page is the whole path for that app: what to install, what the engine does and does not have, how the pieces are wired, and what to do about the parts that differ from a browser. The adapters have their own pages: [Expo](expo.md), [Google Play](google-play.md) and [App Store](app-store.md).

The same files run in [the Expo example](https://github.com/priemskiyyy/beacon/tree/main/examples/expo), which is bundled for both platforms by `pnpm --filter example-expo build:native` and whose wiring its tests exercise against a fake `expo-updates`.

## What to install

| You want                                           | Install                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| Expo Updates as a route                            | `@priemskiyyy/beacon`, `@priemskiyyy/beacon-expo`, `expo-updates` |
| Play in-app updates, through a native bridge       | `@priemskiyyy/beacon-google-play`                                 |
| The App Store page of your app and its version     | `@priemskiyyy/beacon-app-store`                                   |
| A provider and hooks for your components           | `@priemskiyyy/beacon-react`, which needs React 19.2 or later      |
| What the installed binary is, and a stored journal | `expo-application` and `expo-sqlite`, or the libraries you use    |

React Native 0.86 and Expo SDK 57 ship React 19.2, which is the range `@priemskiyyy/beacon-react` asks for. It never imports `react-native`, so one binding serves the web and a device.

## The engine and the toolchain

Beacon's packages are ES2022: classes with private fields, `async` functions and optional chaining. Metro compiles them as it compiles your code, because it transforms what is in `node_modules` too. That matters for one reason: Hermes, the engine, differs by version, and the Babel preset decides what reaches it.

| Hermes                                      | What the preset does with a package like this                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1, the default in React Native 0.86        | Expo's preset keeps classes and `async`, and repairs three things the engine compiles wrongly. The preset of a bare app lowers every `async` function |
| Classic, which a bare app can still ask for | The preset lowers classes, private fields and `async`, since that Hermes compiles none of them                                                        |

The three repairs are for facebook/hermes#1761 and two more bugs that Hermes V1 at `hermes-v250829098.0.17`, the one React Native 0.86 builds, still has. The one that concerns a library is an async arrow function whose parameter is not a plain name, such as `async ({ scope }) => {}` or `async (options = {}) => {}`: it resolves `undefined`. Beacon's built packages contain no such function, and a test scans them to keep it so. Your own code is compiled by the same preset, so a custom bundler that keeps `async` and skips the preset must repair it too.

If you bundle without Metro, make sure `@priemskiyyy/*` is transformed like your own code: classic Hermes cannot run a class.

### What Beacon takes from the engine

Hermes and React Native are not a browser and not Node. Two Hermes builds were run for this, V1 and classic, and what follows is what they and React Native 0.86 have. Beacon uses only what both have, and its tests run with the rest removed.

| Beacon uses                                                                                                                      | Where it comes from                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Promise`, `WeakMap`, `WeakSet`, `Object.hasOwn`, `Object.fromEntries`, `Array.prototype.at` and `flatMap`, `Error` with `cause` | Hermes, both builds                                                                                        |
| `AbortController`, and on a signal `aborted`, `addEventListener` with `once`, `removeEventListener`                              | React Native's `abort-controller`, which has no `reason`, no `throwIfAborted` and no `AbortSignal.timeout` |
| `queueMicrotask`, `setTimeout`, `clearTimeout`                                                                                   | React Native                                                                                               |
| `Date.parse` of a UTC timestamp, then `toISOString` to check it                                                                  | Hermes, which rolls month 13, hour 25 or second 60 over where V8 answers `NaN`                             |

| Beacon never uses                                                        | Why                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `crypto.randomUUID`, `crypto.getRandomValues`                            | No `crypto` global on either Hermes. `createBootId()` covers it ([below](#the-boot-id))    |
| `URL`, `URLSearchParams`                                                 | React Native's have a setter for `search` alone, no `canParse`, and read only http(s) URLs |
| `structuredClone`, `TextDecoder`, `Buffer`, `Intl.Segmenter` and its kin | Not there on either Hermes. Expo's runtime adds some that a bare app does not have         |
| `Promise.withResolvers`, `Promise.try`, `WeakRef`, `Set` methods         | Missing on classic Hermes, though V1 has them                                              |
| `toSorted`, `Object.groupBy`, `Map.groupBy`, `FinalizationRegistry`      | Missing on both                                                                            |
| `response.body`, `response.redirected`                                   | React Native's own `fetch` has neither. See [HTTP](http.md#redirects-on-react-native)      |
| `window`, `document`, `localStorage`, `location`                         | No document and no browser storage, and `window` is only the global object                 |

Lint forbids each of these in the packages that ship, and `pnpm test:unit` runs the core, the HTTP, Expo, Play and App Store packages in an environment where they are removed and React Native's own `AbortController`, `URL` and `URLSearchParams` are in their place. A change that reaches for `crypto.randomUUID()` turns a test red.

## Set up the Beacon once

Create the Beacon in a module of its own, outside React. Fast Refresh re-runs a module that exports something other than components together with everything that imports it, so a Beacon in a module you edit often would be made again, and the screens you edit should not be that module.

### The boot id

A boot is one JavaScript runtime, and its id only has to differ from the next runtime's. Hermes has no `crypto.randomUUID` without a polyfill, so `createBootId()` from the core falls back to `crypto.getRandomValues` and then to `Math.random`, and never throws. Make one when the Beacon is created, as [the Beacon below](#the-beacon) does.

### What the binary is

An Expo app reads the installed binary from `expo-application`. An Android build is named by its version code and an iOS build by its build number, in the words the store adapters use, so a journal and a support policy compare like with like. A value the module did not give is unknown, and so is a binary of another application: Expo Go, running your code, describes itself.

```ts
// src/nativeBuild.ts
import type { RunningRelease } from "@priemskiyyy/beacon";
import * as Application from "expo-application";

const APPLICATION = "com.example.notes";

const readText = (value: string | null) => value?.trim() || null;

export const readNativeBuild =
  (platform: "android" | "ios") => (): RunningRelease => {
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
        raw: { applicationId: APPLICATION, versionName: version },
      };
    }

    const domain =
      platform === "android" ? "android-version-code" : "ios-build";

    return {
      identity: {
        status: "known",
        authority: APPLICATION,
        domain,
        value: build,
      },
      label: version,
      raw: {
        applicationId: APPLICATION,
        versionName: version,
        versionCode: build,
      },
    };
  };
```

### The journal's storage

A reload replaces the JavaScript runtime, and the journal is how the next boot learns what it reached. It keeps its record in storage that survives. `expo-sqlite` has a key-value store, and so do AsyncStorage and MMKV, and `keyValueJournalStorage` adapts any of them, reading a record back before it says a write is stored. [Journal](journal.md) says what is written and when.

```ts
// src/journalStorage.ts
import { keyValueJournalStorage } from "@priemskiyyy/beacon";
import keyValueStore from "expo-sqlite/kv-store";

export const journalStorage = keyValueJournalStorage(keyValueStore);
```

### The Beacon

```ts
// src/beacon.ts
import { Beacon, createBootId } from "@priemskiyyy/beacon";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { journalStorage } from "src/journalStorage";
import { readNativeBuild } from "src/nativeBuild";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    // Yours to say: the App Store route answers only for "app-store".
    distribution: Platform.select({
      ios: "app-store",
      android: "google-play",
      default: "development",
    }),
  },
  running: {
    boot: { id: createBootId() },
    bundle: expoBundle(Updates),
    native: readNativeBuild(Platform.OS === "ios" ? "ios" : "android"),
  },
  routes: { ota: expoUpdates({ updates: Updates }) },
  journal: { mode: "best-effort", storage: journalStorage },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

## The provider

Put `BeaconProvider` with `start` near the root. The session it holds is the one every hook reads from.

```tsx
// src/App.tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { StrictMode } from "react";
import { Text, View } from "react-native";

import { beacon } from "src/beacon";
import { useUpdateChecks } from "src/useUpdateChecks";

const Screens = () => {
  useUpdateChecks();

  return (
    <View>
      <Text>Notes</Text>
    </View>
  );
};

export const App = () => (
  <StrictMode>
    <BeaconProvider beacon={beacon} start>
      <Screens />
    </BeaconProvider>
  </StrictMode>
);
```

With Expo, `registerRootComponent(App)` in the entry file, or the default export of `app/_layout.tsx` with Expo Router, is where this goes.

Two things that happen on a device and not on the web:

- **Strict Mode.** A development build runs effects twice. The provider starts a session, ends it and starts it again, and leaves one running. A check in your own effect runs twice and joins the same read.
- **Fast Refresh.** Editing a screen re-renders it and leaves the provider alone. Editing `src/beacon.ts` makes a second Beacon, and the provider moves to it: it ends the old session, which releases the native `expo-updates` module, and starts the new one. So start only through the provider. A `beacon.start()` at the top of a module is never ended, and the second Beacon would fail to open the route with `DRIVER_FAILED`. Nothing of the first Beacon's state is carried over, which is development only.

The hooks render the same in React Native as in `react-dom`: they read a Beacon and start nothing, and the package imports no DOM global when it loads. A selector that builds a new object needs an `isEqual`, as on the web ([React](react.md#selectors)).

## When to check

Check when the app starts, and again each time it returns from the background. React Native's `AppState` says what state the app is in, and two facts decide how to read it:

- On iOS a system dialog, the control center or an incoming call takes the app from `active` to `inactive` and back. Only a trip through `background` is a return. React Native reports `background` when the app leaves, and `active` when it comes back.
- On Android there is no `inactive`, and every pause of the activity is a `background`, including a permission dialog.

```ts
// src/useUpdateChecks.ts
import { useBeacon } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";
import { AppState } from "react-native";

export const useUpdateChecks = () => {
  const beacon = useBeacon();

  useEffect(() => {
    beacon.check({ reason: "startup" });

    let away = AppState.currentState === "background";

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        away = true;

        return;
      }

      if (state !== "active" || !away) {
        return;
      }

      away = false;
      beacon.check({ reason: "foreground" });
    });

    return () => subscription.remove();
  }, [beacon]);
};
```

A check joins a read already in flight, so a quick second return asks nothing more, but a source may still be asked again after it answers. Beacon has no scheduler: an Expo update server may rate limit, so keep your own minimum between checks if your users switch apps often.

## What a reload keeps

`Updates.reloadAsync()` answers before the app reloads, and it replaces the JavaScript runtime. Nothing after the call is guaranteed to run. What goes with the old runtime: every `AppState` listener, every timer, every module variable and the Beacon with its observations. What stays: the record the journal wrote before it asked for the reload. The next boot makes a new Beacon, which reads that record once the running facts have answered, and `beacon.transitions` then says whether the update it asked for is the one that runs.

The route stays unresolved in the old runtime until `route.acknowledge()`, and in practice that runtime is gone. A rollback to the embedded update has an identity nobody named, so a journal can only call it `inconclusive`.

## Guarding unsaved input

A participant answers for what a reload would lose. The hook registers it while the component is mounted and asks the latest one you passed. Expo's `reload` restarts JavaScript, so the impact is `javascript-restart`.

```tsx
// src/DraftInput.tsx
import { useDisruption } from "@priemskiyyy/beacon-react";
import { useRef, useState } from "react";
import { TextInput } from "react-native";

export const DraftInput = () => {
  const [text, setText] = useState("");
  const saved = useRef("");

  useDisruption({
    name: "note",
    impacts: ["javascript-restart"],
    reserve: () => {
      if (text === saved.current) {
        return { status: "reserved", release: () => {} };
      }

      return { status: "blocked", code: "unsaved-note" };
    },
  });

  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onEndEditing={() => {
        saved.current = text;
      }}
    />
  );
};
```

The participant that only answers is advisory: an edit can begin right after it said yes. A screen that must not lose work reserves, as [disruptions](disruptions.md) says.

## Expo Go, a development build and a release build

| Where                        | What the route says                                                                                    | What `native` reads                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Expo Go                      | `unknown`, `unsupported-environment`, and the commands are `unsupported`: updates do not run there     | `another-application`, since Expo Go is its own app |
| A development build          | the same: it reports updates enabled and then refuses every call, which the adapter takes for the same | the build you made                                  |
| A release build with updates | checks, downloads and reloads are the SDK's                                                            | the build you shipped                               |

In a development client `Updates.isEnabled` is `true`, and `checkForUpdateAsync` and `fetchUpdateAsync` reject with `ERR_NOT_AVAILABLE_IN_DEV_CLIENT`. A debug build refuses from JavaScript with `ERR_UPDATES_DISABLED`. The adapter answers both as an environment that cannot update, and never as a failed check. The SDK's own reference says the same of these methods: they cannot be used in Expo Go or development mode. Test an update with a release build.

## What no device has run

Everything here is tested in process, and the packages were also run on the two Hermes builds that React Native ships, V1 and classic, with a fake update module. No device, simulator or store has run a line of it. Still to be seen on each:

- `expo-updates` downloading, selecting and launching an update, and the next boot reading the journal.
- `Updates.reloadAsync()` replacing the runtime, and what an `AppState` listener does as it goes.
- `AppState` on a device: a system dialog taking iOS to `inactive` and back, and any pause taking Android to `background`. The check on return follows what React Native documents, not what a device was seen to send.
- What `expo-application` gives in Expo Go, in a development build and in a release build, in particular that Expo Go answers with its own application id, and that `nativeBuildVersion` is the version code on Android.
- The journal's storage under a kill during a write.
- Play's flows through a real bridge, and the install events of a flexible update.
- The App Store page opened by `Linking.openURL`, and the lookup over a real connection.
- Firebase Remote Config: `fetchAndActivate` on a device, the fetch time of 0 that iOS answers before any fetch, throttling, and when activation reaches the screens ([Firebase Remote Config](firebase-remote-config.md)).
- `fetch` on iOS keeping a cached answer and never giving a `304` to JavaScript, and `response.url` after a redirect on each platform.
- Fast Refresh in a running Metro session. A re-mount and a new Beacon are tested with a test renderer, not with Metro.

[Decisions](decisions.md) keeps the same list for the release.
