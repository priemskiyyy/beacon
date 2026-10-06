---
description: "Use Beacon in a React Native or Expo app: the engine and toolchain it needs, a boot id without crypto, the provider, Fast Refresh and Strict Mode, checks on foreground, what a reload keeps, guarding unsaved input, and what no device has run."
---

# React Native

Beacon runs in a React Native app on Hermes, the engine of React Native, on iOS and Android, with Expo or without it. This page is the whole path for that app: what to install, what the engine does and does not have, how the pieces are wired, and what to do about the parts that differ from a browser. The adapters have their own pages: [Expo](expo.md), [CodePush](code-push.md), [Google Play](google-play.md), [App Store](app-store.md) and [Device info](device-info.md).

The same files run in [the Expo example](https://github.com/priemskiyyy/beacon/tree/main/examples/expo), which is bundled for both platforms by `pnpm --filter example-expo build:native` and whose wiring its tests exercise against a fake `expo-updates`.

## What to install

| You want                                        | Install                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Expo Updates as a route                         | `@priemskiyyy/beacon`, `@priemskiyyy/beacon-expo`, `expo-updates`                                                        |
| CodePush, through the fork you use              | `@priemskiyyy/beacon-code-push` and a CodePush fork                                                                      |
| Play in-app updates, through a native bridge    | `@priemskiyyy/beacon-google-play`                                                                                        |
| The App Store page of your app and its version  | `@priemskiyyy/beacon-app-store`                                                                                          |
| The installed binary as a running fact          | `@priemskiyyy/beacon-expo` with `expo-application`, or `@priemskiyyy/beacon-device-info` with `react-native-device-info` |
| Checks on start, on a return and on a reconnect | `@priemskiyyy/beacon/triggers`, which is part of the core, with `@react-native-community/netinfo` for the reconnect      |
| A minimum build kept in Firebase                | `@priemskiyyy/beacon-firebase-remote-config`, with React Native Firebase                                                 |
| A provider and hooks for your components        | `@priemskiyyy/beacon-react`, which works with React 18.3 to 19                                                           |
| A stored journal                                | `expo-sqlite`, or the store you already use                                                                              |

`@priemskiyyy/beacon-react` asks for React 18.3 to 19, which covers React Native 0.86 and Expo SDK 57, where React is 19.2. It never imports `react-native`, so one binding serves the web and a device.

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

Lint forbids each of these in the packages that ship, and `pnpm test:unit` runs the core (with its triggers), the HTTP, Expo, CodePush, Play, App Store, device info and Firebase Remote Config packages in an environment where they are removed and React Native's own `AbortController`, `URL` and `URLSearchParams` are in their place. A change that reaches for `crypto.randomUUID()` turns a test red.

## Set up the Beacon once

Create the Beacon in a module of its own, outside React. Fast Refresh re-runs a module that exports something other than components together with everything that imports it, so a Beacon in a module you edit often would be made again, and the screens you edit should not be that module.

### The boot id

A boot is one JavaScript runtime, and its id only has to differ from the next runtime's. Beacon mints it for you, once for the runtime and shared by every Beacon made in it, which is also what a Fast Refresh that makes the Beacon again needs: the new Beacon is the same boot. Hermes has no `crypto.randomUUID` without a polyfill, so `createBootId()` falls back to `crypto.getRandomValues` and then to `Math.random`, and never throws. Call it yourself, and pass the result as `running: { boot: { id } }`, only for an id of your own.

### What the binary is

An Expo app reads the installed binary from `expo-application` with `expoApplication` of `@priemskiyyy/beacon-expo`. An Android build is named by its version code and an iOS build by its build number, in the words the store adapters use, so a journal and a support policy compare like with like. The platform is the scope's `platform` (what `Platform.OS` says) and the authority is its `application`, so the reader needs nothing but the module: a scope that is neither `ios` nor `android` is unknown with the reason `unsupported-platform`. A value the module did not give is unknown, and so is a binary of another application: Expo Go, running your code, describes itself, and the authority is what makes that say `another-application` and keeps its numbers out of your facts. An app on `react-native-device-info` uses `deviceInfo` of `@priemskiyyy/beacon-device-info` the same way, which also takes the text `unknown` that library answers for a value it could not read.

```ts
// src/nativeBuild.ts
import { expoApplication } from "@priemskiyyy/beacon-expo";
import * as Application from "expo-application";

export const nativeBuild = expoApplication({ application: Application });
```

| Field                | Android                                       | iOS                                            |
| -------------------- | --------------------------------------------- | ---------------------------------------------- |
| `identity.authority` | the application id the binary reports         | the bundle id the binary reports               |
| `identity.domain`    | `android-version-code`                        | `ios-build`                                    |
| `identity.value`     | the version code as text                      | the build number (`CFBundleVersion`) as text   |
| `label`              | the version name                              | the marketing version                          |
| `raw`                | `applicationId`, `versionName`, `versionCode` | `applicationId`, `shortVersion`, `buildNumber` |

Every `raw` value is text, or null where the module gave none. The identity is `unknown` with the reason `build-not-read` where the module gave no build number, `application-not-read` where it gave no application id, `another-application` for a binary that is not yours and `unsupported-platform` for a scope that is not Android or iOS. A build is never read as zero, as null or as a build named `unknown`. [Troubleshooting](troubleshooting.md#the-installed-binary-is-unknown) says what to do about each.

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
import { Beacon } from "@priemskiyyy/beacon";
import { expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { journalStorage } from "src/journalStorage";
import { nativeBuild } from "src/nativeBuild";

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
  // The route reads the running bundle itself, so the journal can tell which update a reload reached.
  running: { native: nativeBuild },
  routes: { ota: expoUpdates({ updates: Updates }) },
  journal: { storage: journalStorage },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

## The provider

Put `BeaconProvider` near the root. It starts the session while it is mounted, and ends it when it unmounts, and that session is the one every hook reads from.

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
    <BeaconProvider beacon={beacon}>
      <Screens />
    </BeaconProvider>
  </StrictMode>
);
```

With Expo, `registerRootComponent(App)` in the entry file, or the default export of `app/_layout.tsx` with Expo Router, is where this goes.

Two things that happen on a device and not on the web:

- **Strict Mode.** A development build runs effects twice. The provider starts a session, ends it and starts it again, and leaves one running. A `checkOn` in your own effect stops and starts again and leaves one set of listeners, and its first check joins the read already in flight.
- **Fast Refresh.** Editing a screen re-renders it and leaves the provider alone. Editing `src/beacon.ts` makes a second Beacon, and the provider moves to it: it ends the old session, which releases the native `expo-updates` module, and starts the new one. So let the provider start it, which it does unless you pass `start={false}`. A `beacon.start()` at the top of a module is never ended, and the second Beacon would fail to open the route with `DRIVER_FAILED`. Nothing of the first Beacon's state is carried over, which is development only.

The hooks render the same in React Native as in `react-dom`: they read a Beacon and start nothing, and the package imports no DOM global when it loads. A selector that builds a new object needs an `isEqual`, as on the web ([React](react.md#selectors)).

## When to check

Check when the app starts, again each time it returns from the background, when the network comes back and now and then. [`@priemskiyyy/beacon/triggers`](triggers.md) does that, and it keeps the rule about React Native's `AppState` so your code does not. Two facts decide how to read it:

- On iOS a system dialog, the control center or an incoming call takes the app from `active` to `inactive` and back. Only a trip through `background` is a return. React Native reports `background` when the app leaves, and `active` when it comes back.
- On Android there is no `inactive`, and every pause of the activity is a `background`, including a permission dialog.

```sh
pnpm add @react-native-community/netinfo
```

```ts
// src/useUpdateChecks.ts
import { useBeacon } from "@priemskiyyy/beacon-react";
import {
  checkOn,
  foreground,
  interval,
  reconnect,
} from "@priemskiyyy/beacon/triggers";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

export const useUpdateChecks = () => {
  const beacon = useBeacon();

  useEffect(
    () =>
      checkOn(beacon, {
        triggers: [
          foreground({ appState: AppState, minAway: 30_000 }),
          reconnect({ netInfo: NetInfo }),
          interval({ every: 30 * 60_000, jitter: 0.2 }),
        ],
        backoff: { first: 10_000, max: 15 * 60_000 },
      }),
    [beacon],
  );
};
```

`checkOn` checks once each time the session opens, without a trigger to list, and subscribes to nothing until it is called, and then only to the Beacon's status: each trigger subscribes to its own source while the session that the provider opened is open, and takes it back when it ends or when the effect's cleanup stops it. So the order of the provider's effect and this one does not matter. `foreground` listens to `AppState`'s `change` event, `reconnect` to NetInfo's state, and `interval` arms one timer that pauses while the app is in the background. NetInfo tells a new listener the state it knows at once, which is not a reconnect, so nothing is checked because of it.

Several signals at once cost one read, signals inside `minInterval` (5 seconds) become one later start, and `backoff` holds the next check off after a failure, so an Expo update server that rate limits is not asked faster than you say. `minAway` skips a return after less than that many milliseconds. [Triggers](triggers.md) has the timing of each, what it does not do and what a device still has to show.

## What a reload keeps

`Updates.reloadAsync()` answers before the app reloads, and it replaces the JavaScript runtime. Nothing after the call is guaranteed to run. What goes with the old runtime: every `AppState` listener, every timer, every module variable and the Beacon with its observations. What stays: the record the journal wrote before it asked for the reload. The next boot makes a new Beacon, which reads that record once the running facts have answered, and `beacon.transitions` then says whether the update it asked for is the one that runs.

The route stays unresolved in the old runtime until `route.acknowledge()`, and in practice that runtime is gone. A rollback to the embedded update has an identity nobody named, so a journal can only call it `inconclusive`.

## Guarding unsaved input

A participant answers for what a reload would lose. The hook registers it while the component is mounted and asks the latest one you passed. It is asked before every impact that loses in-memory state, which includes Expo's `reload` (`javascript-restart`), so it names none.

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
    reserve: () => {
      if (text === saved.current) {
        return { status: "reserved" };
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

## Seeing failures in development

The failures of a check, of a read of what is running, of the support policy and of the journal are events on `beacon.diagnostics.events`, and nothing is built for them until someone subscribes. Log the failures in a development build, from a file your entry imports once:

```ts
// src/logFailures.ts
import { beacon } from "src/beacon";

if (__DEV__) {
  beacon.diagnostics.events.subscribe((event) => {
    if (event.type.endsWith("failed")) {
      console.warn(
        "[beacon]",
        event.type,
        event.route,
        event.reason,
        event.cause,
      );
    }
  });
}
```

The events that end in `failed` are `route-failed`, `read-failed`, `running-failed`, `policy-failed` and `journal-failed`; `event.route` names the route, when there is one, and `event.reason` says what failed: an error code such as `SOURCE_FAILED`, the subject that could not be read, or what the journal was doing. A failure event also carries the value that was thrown as `event.cause`, which is `null` when nothing was thrown: log it beside the reason to see the provider's own message and stack. It is the raw value, so it can hold whatever the provider put in it, and an event must lose its `cause` before it is forwarded to a crash reporter or any other telemetry. The inspector of [Devtools](devtools.md) shows the same events, but it mounts into a DOM, so it is a web tool: in a React Native app, log them.

## Expo Go, a development build and a release build

| Where                        | What the route says                                                                                    | What `native` reads                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Expo Go                      | `unknown`, `unsupported-environment`, and the commands are `unsupported`: updates do not run there     | `another-application`, since Expo Go is its own app |
| A development build          | the same: it reports updates enabled and then refuses every call, which the adapter takes for the same | the build you made                                  |
| A release build with updates | checks, downloads and reloads are the SDK's                                                            | the build you shipped                               |

In a development client `Updates.isEnabled` is `true`, and `checkForUpdateAsync` and `fetchUpdateAsync` reject with `ERR_NOT_AVAILABLE_IN_DEV_CLIENT`. A debug build refuses from JavaScript with `ERR_UPDATES_DISABLED`. The adapter answers both as an environment that cannot update, and never as a failed check. The SDK's own reference says the same of these methods: they cannot be used in Expo Go or development mode. Test an update with a release build.

## Testing in an Expo app

The default test runner of an Expo app is Jest through `jest-expo`, which leaves what is in `node_modules` uncompiled, and Beacon's packages are ES modules. Until the preset's `transformIgnorePatterns` lets `@priemskiyyy` through, a test that imports one fails with `SyntaxError: Cannot use import statement outside a module`:

```js
// jest.config.cjs
const preset = require("jest-expo/jest-preset");

module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    preset.transformIgnorePatterns[0].replace("(?!(", "(?!(@priemskiyyy|"),
    ...preset.transformIgnorePatterns.slice(1),
  ],
};
```

`jest-expo` 57 also asks for `@react-native/jest-preset`, at the version of your React Native, as a peer. Nothing of a device is needed once both are in place: `createFakeUpdates` of `@priemskiyyy/beacon-expo/mock` is a fake `expo-updates` module, `createTestClock` moves time, and [Testing](testing.md#testing-in-an-expo-app) has a Jest test that checks, downloads and restarts with them.

The same fake shows the banner where updates never run. Expo Go and a development build report the route as unknown, so swap the fake in for the module while you develop, and the banner, the guard and the restart answer as they would on a release build:

```ts
// src/routes.ts
import { expoUpdates } from "@priemskiyyy/beacon-expo";
import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";
import * as Updates from "expo-updates";

export const routes = {
  ota: expoUpdates({
    updates: __DEV__ ? createFakeUpdates({ available: true }) : Updates,
  }),
};
```

A fake update launches nothing, and `reloadAsync` of the fake restarts nothing, so the route is unresolved afterwards as it is on a device. Metro inlines `__DEV__` as `false` in a release build, so the real module is the one it uses, and the fake stays small if the bundler keeps the import.

## What no device has run

Everything here is tested in process, and the packages were also run on the two Hermes builds that React Native ships, V1 and classic, with a fake update module. No device, simulator or store has run a line of it. Still to be seen on each:

- `expo-updates` downloading, selecting and launching an update, and the next boot reading the journal.
- `Updates.reloadAsync()` replacing the runtime, and what an `AppState` listener does as it goes.
- `AppState` on a device: a system dialog taking iOS to `inactive` and back, and any pause taking Android to `background`. The check on return follows what React Native documents, not what a device was seen to send.
- NetInfo on a device: the state it reports as soon as it is subscribed to, and across a real change of network, which `reconnect` reads as a reconnect only when it saw the network lost first.
- Timers while the app is in the background: iOS suspending JavaScript, Android throttling it, and an `interval` that resumes at the return.
- What `expo-application` gives in Expo Go, in a development build and in a release build, in particular that Expo Go answers with its own application id, and that `nativeBuildVersion` is the version code on Android and the build number on iOS for each flavor, and what `react-native-device-info` gives on a device.
- The journal's storage under a kill during a write.
- Play's flows through a real bridge, and the install events of a flexible update.
- A CodePush package downloaded, installed for the next start and listed as pending by a real module, `restartApp(true)` replacing the runtime, the rollback when `notifyAppReady()` is missing, and each fork's server giving one hash to a package throughout. [CodePush](code-push.md#what-no-device-has-run) has the list.
- The App Store page opened by `Linking.openURL`, and the lookup over a real connection.
- Firebase Remote Config: `fetchAndActivate` on a device, the fetch time of 0 that iOS answers before any fetch, throttling, and when activation reaches the screens ([Firebase Remote Config](firebase-remote-config.md)).
- `fetch` on iOS keeping a cached answer and never giving a `304` to JavaScript, and `response.url` after a redirect on each platform.
- Fast Refresh in a running Metro session. A re-mount and a new Beacon are tested with a test renderer, not with Metro.

[Decisions](decisions.md) keeps the same list for the release.
