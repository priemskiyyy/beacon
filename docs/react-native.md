---
description: "Ship a safe update banner in an Expo app: Expo Updates as a route, a check at startup and on return, the banner, a guard for unsaved input, a forced-upgrade screen, Expo Go and Jest, then the journal, Hermes and what no device has run."
---

# React Native

This page takes an Expo app to a banner that offers an update and never restarts over unsaved input, and to a screen that stops a build that is too old. The steps are small files, and everything after [Next](#next) is optional.

::: tip Which packages do I install?
An Expo app takes three of ours and two SDKs. `expo-application` is only for [the forced upgrade](#stop-a-build-that-is-too-old) that follows.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react @priemskiyyy/beacon-expo
npx expo install expo-updates expo-application
```

Without Expo, [CodePush](code-push.md) and [device info](device-info.md) take the place of `beacon-expo`.
:::

## Create the Beacon

```ts
// src/beacon.ts
import { Beacon } from "@priemskiyyy/beacon";
import { expoUpdates } from "@priemskiyyy/beacon-expo";
import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

const APPLICATION = "com.example.notes";
const ios = Platform.OS === "ios";

export const beacon = new Beacon({
  scope: {
    application: APPLICATION,
    environment: "production",
    platform: Platform.OS,
    distribution: ios ? "app-store" : "google-play",
  },
  routes: {
    // In development the fake offers an update, so the banner can be seen in Expo Go.
    ota: expoUpdates({
      updates: __DEV__ ? createFakeUpdates({ available: true }) : Updates,
    }),
  },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

`scope` says which app this is. Its four strings name the journal's record and the store a route speaks for, so none has a default. `expoUpdates` takes the `expo-updates` module you pass, which Beacon never imports, and reads which update runs from it. `Register` tells the hooks which Beacon you have, so `useRoute("ota")` is checked and typed. Constructing a Beacon starts nothing.

## Start it and check

```tsx
// src/App.tsx
import { checkOn, foreground } from "@priemskiyyy/beacon/triggers";
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";
import { AppState, View } from "react-native";

import { beacon } from "./beacon";
import { DraftForm } from "./DraftForm";
import { UpdateBanner } from "./UpdateBanner";

export const App = () => {
  // Checks when the app starts and each time it returns from the background.
  useEffect(
    () => checkOn(beacon, { triggers: [foreground({ appState: AppState })] }),
    [],
  );

  return (
    <BeaconProvider beacon={beacon}>
      <View style={{ flex: 1, gap: 16, padding: 24, paddingTop: 64 }}>
        <UpdateBanner />
        <DraftForm />
      </View>
    </BeaconProvider>
  );
};
```

The provider starts the session while it is mounted and ends it when it unmounts, and nothing is read before that. `checkOn` installs its triggers only while a session is open, so it checks once when the provider has started one, and the order of the provider and the effect does not matter. It answers its stop, which is what the effect returns. `foreground` knows that an iOS system dialog, which takes the app to `inactive` and back, is not a return. `index.ts` registers the app with `registerRootComponent(App)`.

## Show the update

```tsx
// src/UpdateBanner.tsx
import { applyUpdate } from "@priemskiyyy/beacon-expo";
import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";
import { useState } from "react";
import { Button, Text, View } from "react-native";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const { observation } = useRoute("ota");
  const [notice, setNotice] = useState<string | null>(null);

  if (observation.status !== "available") {
    return null;
  }

  const update = async () => {
    const applied = await applyUpdate(beacon.route("ota"));

    if (applied.step !== "reload" || applied.outcome.status !== "blocked") {
      return;
    }

    setNotice("Save your note, then update.");
  };

  return (
    <View>
      <Text>A new version is ready.</Text>
      {notice !== null && <Text>{notice}</Text>}
      <Button title="Update" onPress={update} />
    </View>
  );
};
```

The banner shows while Expo has an update on offer. `applyUpdate` downloads it, then restarts into what is prepared, and answers where it stopped. It never throws, and a participant that blocks the restart is its `blocked` outcome. An accepted restart is a request: no code after it is guaranteed to run, and only the next launch shows which update runs ([the journal](#the-journal) says so once).

## Guard unsaved input

```tsx
// src/DraftForm.tsx
import { useDisruption } from "@priemskiyyy/beacon-react";
import { useState } from "react";
import { Button, TextInput, View } from "react-native";

export const DraftForm = () => {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");

  useDisruption({
    name: "note",
    reserve: () => {
      if (text !== saved) {
        return { status: "blocked", code: "unsaved-note" };
      }

      return { status: "reserved" };
    },
  });

  return (
    <View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write a note"
      />
      <Button title="Save" onPress={() => setSaved(text)} />
    </View>
  );
};
```

Beacon asks a participant before a command that would lose what the app holds in memory, and one that names no `impacts` is asked before every such command. The download loses nothing, so it goes on, and only the restart waits. This guard answers a question and does not stop typing, so an edit can begin right after it said yes: [disruptions](disruptions.md) has the guard that reserves.

## See it and test it

In Expo Go the fake of `src/beacon.ts` offers an update, so the banner shows. Tap it with unsaved text and the notice appears. A fake restarts nothing, so after an accepted tap the route waits, as it does on a device: reload the app to try again. A release build uses the real module, and Expo Updates then decides what is on offer ([where each kind of build stands](#expo-go-a-development-build-and-a-release-build)).

Under Jest, `jest-expo` compiles only the packages it lists and Beacon's are ES modules, so let `@priemskiyyy` through:

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

[Testing](testing.md#testing-in-an-expo-app) has a test that checks, downloads and restarts with `createFakeUpdates` and a test clock.

## Next

A banner usually wants two more things, and they follow on this page: [a screen for a build that is too old](#stop-a-build-that-is-too-old) and [a record that says "Updated."](#the-journal). The rest is a page of its own.

- [Expo](expo.md): what a check reports, each command and receipt, runtime versions and channels.
- [Disruptions](disruptions.md) has a guard that reserves, and [support](support.md) a policy of your own.
- [Triggers](triggers.md) adds a reconnect, an interval and a backoff to the checks.
- [Troubleshooting](troubleshooting.md) and [Testing](testing.md).
- Other updaters and sources: [CodePush](code-push.md), [device info](device-info.md), [Firebase Remote Config](firebase-remote-config.md) and [Google Play's in-app updates](google-play.md).

### Stop a build that is too old

A forced upgrade has three parts. `minimumBuild` compares the build that runs with the least you accept, `appStore` and `playStore` open the store page, and `useSupport` tells a screen when the build is `unsupported`. The two stores are packages of their own, and import no SDK.

```sh
pnpm add @priemskiyyy/beacon-app-store @priemskiyyy/beacon-google-play
```

Replace `src/beacon.ts` with the Beacon below. It adds the build reader, the `store` route and the `policy`: the imports of the two stores, `createReleaseSource`, `expoApplication` and `Linking`, the `catalog`, `running`, `store` and `policy`.

```ts
// src/beacon.ts
import { Beacon, minimumBuild } from "@priemskiyyy/beacon";
import { createReleaseSource } from "@priemskiyyy/beacon/adapter";
import { appStore } from "@priemskiyyy/beacon-app-store";
import { expoApplication, expoUpdates } from "@priemskiyyy/beacon-expo";
import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";
import { playStore } from "@priemskiyyy/beacon-google-play";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { Linking, Platform } from "react-native";

const APPLICATION = "com.example.notes";
const ios = Platform.OS === "ios";

// The lowest build the server still accepts. Here a constant: an application reads it from its own backend or Remote Config.
const catalog = createReleaseSource({
  name: "catalog",
  read: async () => ({ document: { minimumBuild: 120 } }),
});

export const beacon = new Beacon({
  scope: {
    application: APPLICATION,
    environment: "production",
    platform: Platform.OS,
    distribution: ios ? "app-store" : "google-play",
  },
  running: { native: expoApplication({ application: Application }) },
  routes: {
    // In development the fake offers an update, so the banner can be seen in Expo Go.
    ota: expoUpdates({
      updates: __DEV__ ? createFakeUpdates({ available: true }) : Updates,
    }),
    // The appId is a placeholder: the numeric id of your app in App Store Connect.
    store: ios
      ? appStore({ appId: "284882215", country: "us", linking: Linking })
      : playStore({ applicationId: APPLICATION, linking: Linking }),
  },
  policy: minimumBuild({
    source: catalog.select((document) => document.minimumBuild),
    remediation: "store",
  }),
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

```tsx
// src/ForcedUpgrade.tsx
import { useBeacon, useSupport } from "@priemskiyyy/beacon-react";
import type { PropsWithChildren } from "react";
import { Button, Text, View } from "react-native";

export const ForcedUpgrade = ({ children }: PropsWithChildren) => {
  const beacon = useBeacon();
  const unsupported = useSupport(({ status }) => status === "unsupported");

  if (!unsupported) {
    return children;
  }

  return (
    <View>
      <Text>This version is no longer supported.</Text>
      <Button
        title="Update from the store"
        onPress={() => beacon.route("store").openStore()}
      />
    </View>
  );
};
```

Then `App.tsx` wraps the banner and the form in it, and is the whole app:

```tsx
// src/App.tsx
import { checkOn, foreground } from "@priemskiyyy/beacon/triggers";
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";
import { AppState, View } from "react-native";

import { beacon } from "./beacon";
import { DraftForm } from "./DraftForm";
import { ForcedUpgrade } from "./ForcedUpgrade";
import { UpdateBanner } from "./UpdateBanner";

export const App = () => {
  // Checks when the app starts and each time it returns from the background.
  useEffect(
    () => checkOn(beacon, { triggers: [foreground({ appState: AppState })] }),
    [],
  );

  return (
    <BeaconProvider beacon={beacon}>
      <View style={{ flex: 1, gap: 16, padding: 24, paddingTop: 64 }}>
        <ForcedUpgrade>
          <UpdateBanner />
          <DraftForm />
        </ForcedUpgrade>
      </View>
    </BeaconProvider>
  );
};
```

A build below 120 is `unsupported`. Until the build is read, and in Expo Go, whose build is another application's, support is `unknown`, which never locks anyone out. Each store route opens its own store, and answers `unsupported` for any other distribution, so a development build is never sent to one. The constant reaches the builds that receive that bundle: [Firebase Remote Config](firebase-remote-config.md) or [a source of your own](routes.md#sources) holds a minimum you change without a release.

### The journal

A restart replaces the JavaScript runtime, and the Beacon with it. The next launch can only learn what the restart reached from a record that survives, so give the journal a key-value store. `expo-sqlite/kv-store` is the Expo SDK's own (`npx expo install expo-sqlite`), and AsyncStorage and MMKV fit too: [the journal](journal.md#choosing-a-storage) says which to choose.

```ts
// src/journal.ts
import type { JournalOptions } from "@priemskiyyy/beacon";
import keyValueStore from "expo-sqlite/kv-store";

export const journal = { storage: keyValueStore } satisfies JournalOptions;
```

Pass it as `journal` to the `Beacon`. The mode is `best-effort`, so a broken store never blocks an update. `judgedHere` is true only on the launch that judged the restart, so a thank-you shows once:

```tsx
// src/Updated.tsx
import { useTransitions } from "@priemskiyyy/beacon-react";
import { Text } from "react-native";

export const Updated = () => {
  const updated = useTransitions(
    ({ latest }) =>
      latest?.judgedHere === true && latest.outcome === "target-running",
  );

  if (!updated) {
    return null;
  }

  return <Text>Updated.</Text>;
};
```

## Advanced

### The installed binary

`expoApplication` reads the version code on Android and the build number on iOS, under the application and the platform of the scope, in the words the store routes and the journal compare in. [Expo](expo.md#the-installed-binary) lists its fields and every reason it can be unknown, and [troubleshooting](troubleshooting.md#the-installed-binary-is-unknown) what to do about each.

### The boot id

A boot is one JavaScript runtime, and its id only has to differ from the next runtime's. Beacon mints it for you, once for the runtime and shared by every Beacon made in it, which is also what a Fast Refresh that makes the Beacon again needs: the new Beacon is the same boot. Hermes has no `crypto.randomUUID` without a polyfill, so `createBootId()` falls back to `crypto.getRandomValues` and then to `Math.random`, and never throws. Call it yourself, and pass the result as `running: { boot: { id } }`, only for an id of your own.

### The provider

`@priemskiyyy/beacon-react` asks for React 18.3 to 19, which covers React Native 0.86 and Expo SDK 57, where React is 19.2. It never imports `react-native`, so one binding serves the web and a device. Two things happen on a device and not on the web:

- **Strict Mode.** A development build runs effects twice. The provider starts a session, ends it and starts it again, and leaves one running. A `checkOn` in your own effect stops and starts again and leaves one set of listeners, and its first check joins the read already in flight.
- **Fast Refresh.** Editing a screen re-renders it and leaves the provider alone. Editing `src/beacon.ts` makes a second Beacon, and the provider moves to it: it ends the old session, which releases the native `expo-updates` module, and starts the new one. So let the provider start it, which it does unless you pass `start={false}`. A `beacon.start()` at the top of a module is never ended, and the second Beacon would fail to open the route with `DRIVER_FAILED`. Nothing of the first Beacon's state is carried over, which is development only.

A selector that builds a new object needs an `isEqual`, as on the web ([React](react.md#selectors)).

### When to check

Check when the app starts, each time it returns from the background, when the network comes back and now and then. On iOS a system dialog, the control center or an incoming call takes the app from `active` to `inactive` and back, and only a trip through `background` is a return. On Android there is no `inactive`, and every pause of the activity is a `background`, including a permission dialog. `foreground` keeps that rule so your code does not.

```sh
npx expo install @react-native-community/netinfo
```

```ts
// src/useChecks.ts
import {
  checkOn,
  foreground,
  interval,
  reconnect,
} from "@priemskiyyy/beacon/triggers";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

import { beacon } from "./beacon";

export const useChecks = () => {
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
    [],
  );
};
```

Call `useChecks()` in `App` in place of its effect. `foreground` listens to `AppState`'s `change` event, `reconnect` to NetInfo's state, and `interval` arms one timer that pauses while the app is in the background. NetInfo tells a new listener the state it knows at once, which is not a reconnect, so nothing is checked because of it. Several signals at once cost one read, signals inside `minInterval` (5 seconds) become one later start, and `backoff` holds the next check off after a failure, so an update server that rate limits is not asked faster than you say. `minAway` skips a return after less than that many milliseconds. [Triggers](triggers.md) has the timing of each, what it does not do and what a device still has to show.

### What a reload keeps

`Updates.reloadAsync()` answers before the app reloads, and it replaces the JavaScript runtime. Nothing after the call is guaranteed to run. What goes with the old runtime: every `AppState` listener, every timer, every module variable and the Beacon with its observations. What stays: the record the journal wrote before it asked for the reload. The next boot makes a new Beacon, which reads that record once the running facts have answered, and `beacon.transitions` then says whether the update it asked for is the one that runs.

The route stays unresolved in the old runtime until `route.acknowledge()`, and in practice that runtime is gone. A rollback to the embedded update has an identity nobody named, so a journal can only call it `inconclusive`.

### Seeing failures in development

The failures of a check, of a read of what is running, of the support policy and of the journal are events on `beacon.diagnostics.events`, and nothing is built for them until someone subscribes. Log the failures in a development build, from a file your entry imports once:

```ts
// src/logFailures.ts
import { beacon } from "./beacon";

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

### Expo Go, a development build and a release build

| Where                        | What the route says                                                                                    | What `native` reads                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Expo Go                      | `unknown`, `unsupported-environment`, and the commands are `unsupported`: updates do not run there     | `another-application`, since Expo Go is its own app |
| A development build          | the same: it reports updates enabled and then refuses every call, which the adapter takes for the same | the build you made                                  |
| A release build with updates | checks, downloads and reloads are the SDK's                                                            | the build you shipped                               |

In a development client `Updates.isEnabled` is `true`, and `checkForUpdateAsync` and `fetchUpdateAsync` reject with `ERR_NOT_AVAILABLE_IN_DEV_CLIENT`. A debug build refuses from JavaScript with `ERR_UPDATES_DISABLED`. The adapter answers both as an environment that cannot update, and never as a failed check. The SDK's own reference says the same of these methods: they cannot be used in Expo Go or development mode. Test an update with a release build. The fake of the first step stands in only while `__DEV__` is true: Metro makes it `false` in a release build, so the real module is the one that runs.

### A universal app

`Register` names one Beacon for one TypeScript program. An app that runs on the web and on devices usually has a Beacon of each (`ota` on a device, `web` in a page), and merging both into `Register` fails with `Subsequent property declarations must have the same type`. Give each platform its own `tsconfig`, so each program sees one registration, or register one and read the other with `useObservable(other.route("web").state)`.

### The engine and the toolchain

Beacon runs on Hermes, the engine of React Native, on iOS and Android. Its packages are ES2022: classes with private fields, `async` functions and optional chaining. Metro compiles them as it compiles your code, because it transforms what is in `node_modules` too. That matters for one reason: Hermes differs by version, and the Babel preset decides what reaches it.

| Hermes                                      | What the preset does with a package like this                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1, the default in React Native 0.86        | Expo's preset keeps classes and `async`, and repairs three things the engine compiles wrongly. The preset of a bare app lowers every `async` function |
| Classic, which a bare app can still ask for | The preset lowers classes, private fields and `async`, since that Hermes compiles none of them                                                        |

The three repairs are for facebook/hermes#1761 and two more bugs that Hermes V1 at `hermes-v250829098.0.17`, the one React Native 0.86 builds, still has. The one that concerns a library is an async arrow function whose parameter is not a plain name, such as `async ({ scope }) => {}` or `async (options = {}) => {}`: it resolves `undefined`. Beacon's built packages contain no such function, and a test scans them to keep it so. Your own code is compiled by the same preset, so a custom bundler that keeps `async` and skips the preset must repair it too. If you bundle without Metro, make sure `@priemskiyyy/*` is transformed like your own code: classic Hermes cannot run a class.

#### What Beacon takes from the engine

Hermes and React Native are not a browser and not Node. Two Hermes builds were run for this, V1 and classic, and what follows is what they and React Native 0.86 have. Beacon uses only what both have, and its tests run with the rest removed.

| Beacon uses                                                                                                                      | Where it comes from                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Promise`, `WeakMap`, `WeakSet`, `Object.hasOwn`, `Object.fromEntries`, `Array.prototype.at` and `flatMap`, `Error` with `cause` | Hermes, both builds                                                                                        |
| `AbortController`, and on a signal `aborted`, `addEventListener` with `once`, `removeEventListener`                              | React Native's `abort-controller`, which has no `reason`, no `throwIfAborted` and no `AbortSignal.timeout` |
| `queueMicrotask`, `setTimeout`, `clearTimeout`                                                                                   | React Native                                                                                               |
| `Date.parse` of a UTC timestamp, then `toISOString` to check it                                                                  | Hermes, which rolls month 13, hour 25 or second 60 over where V8 answers `NaN`                             |

| Beacon never uses                                                        | Why                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `crypto.randomUUID`, `crypto.getRandomValues`                            | No `crypto` global on either Hermes. `createBootId()` covers it ([above](#the-boot-id))    |
| `URL`, `URLSearchParams`                                                 | React Native's have a setter for `search` alone, no `canParse`, and read only http(s) URLs |
| `structuredClone`, `TextDecoder`, `Buffer`, `Intl.Segmenter` and its kin | Not there on either Hermes. Expo's runtime adds some that a bare app does not have         |
| `Promise.withResolvers`, `Promise.try`, `WeakRef`, `Set` methods         | Missing on classic Hermes, though V1 has them                                              |
| `toSorted`, `Object.groupBy`, `Map.groupBy`, `FinalizationRegistry`      | Missing on both                                                                            |
| `response.body`, `response.redirected`                                   | React Native's own `fetch` has neither. See [HTTP](http.md#redirects-on-react-native)      |
| `window`, `document`, `localStorage`, `location`                         | No document and no browser storage, and `window` is only the global object                 |

Lint forbids each of these in the packages that ship, and `pnpm test:unit` runs the core (with its triggers), the HTTP, Expo, CodePush, Play, App Store, device info and Firebase Remote Config packages in an environment where they are removed and React Native's own `AbortController`, `URL` and `URLSearchParams` are in their place. A change that reaches for `crypto.randomUUID()` turns a test red.

### What no device has run

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
- The Play Store page opened by `Linking.openURL` with the `market://` link, and the web page it falls back to where no Play Store app handles it.
- Firebase Remote Config: `fetchAndActivate` on a device, the fetch time of 0 that iOS answers before any fetch, throttling, and when activation reaches the screens ([Firebase Remote Config](firebase-remote-config.md)).
- `fetch` on iOS keeping a cached answer and never giving a `304` to JavaScript, and `response.url` after a redirect on each platform.
- Fast Refresh in a running Metro session. A re-mount and a new Beacon are tested with a test renderer, not with Metro.

[Decisions](decisions.md) keeps the same list for the release.
