# Release lab on Expo, a Beacon example

The same release lab on the web, and a real Beacon over Expo Updates on iOS and Android. The user interface reuses the hooks of `@priemskiyyy/beacon-react` with React Native components.

```sh
pnpm install
pnpm build
pnpm --filter example-expo dev
```

The platform files choose what starts, never a runtime check: `src/lab/startLab.web.ts` runs the scripted lab from `../shared` (Metro and `react-native-web` serve it in a browser), and `src/lab/startLab.native.ts` builds a real Beacon with `expoUpdates({ updates: Updates })` and `expoBundle({ updates: Updates })` from `@priemskiyyy/beacon-expo`, where `Updates` is the `expo-updates` module the application imports.

## The web build

It is the lab of `example-react` with React Native components: the same world, the same controls (the buttons of the simulated world), the same timeline. Status facts, the banner outcome and the transitions carry a `testID`, which is how the Playwright spec reads them. `?latency=0` makes the release service answer at once.

## The device build

The native Beacon has one route, `ota`, which `expo-updates` owns: the check, the download and the reload are the provider's, mapped in full by the adapter. What it shows:

- In Expo Go and development builds updates are disabled, so the route is `unknown` with the reason `unsupported-environment`, never "no update". A build with `expo-updates` configured (an update URL and a runtime version) checks for real.
- `Download` prepares the provider's current selection, which may differ from the offer: the receipt says `same`, `different` or `unknown`. `Reload` needs the prepared reference, restarts the JavaScript runtime and guarantees no code after it.
- The support policy reads the application's own manifest. That backend is a mock source here, answering that no update has ended; in an application it is `http()` from `@priemskiyyy/beacon-http` over the application's client.
- The journal is on, in `expo-sqlite/kv-store` (`keyValueJournalStorage` in `src/lab/startLab.native.ts`): a reload replaces the JavaScript runtime, so what the Beacon asked for is recorded in storage that survives it, and the next boot reads it once the running facts have answered. The panel shows the journal's state.
- The installed binary is a `native` running fact read with `expo-application` (`expoApplication` of `@priemskiyyy/beacon-native`, in `src/lab/createNativeBeacon.ts`): the build number under the domain `android-version-code` or `ios-build`, with the application id as authority. In Expo Go the application id is Expo Go's own, so the fact says `another-application`, and a build that gave no number says `build-not-read`.
- The app checks when it starts and each time it returns from the background with `checkOn`, which checks at startup by itself, and `foreground({ appState: AppState })` from `@priemskiyyy/beacon/triggers` (`src/components/Native/NativeApplication.tsx`). A system dialog on iOS is `inactive` and back to `active` and is not a return, and the trigger knows it.

The native user interface passes its Beacon down and reads it with `useObservable`. The registered hooks and `BeaconProvider` are typed for one Beacon, and the lab's Beacon has other routes than the device's, so the native tree cannot use them.

## Checks on a device

1. Launch a development build: the check reports an environment that cannot check, and support is unknown.
2. Launch a release build with an update published to its channel: the offer appears. Download it, and read the receipt.
3. Reload: the runtime restarts, and only the running bundle of the next launch says which update runs.
4. Publish a rollback to the embedded update: the offer is a rollback, with an identity nobody named.

Record the runtime line, the device, the build mode and the timeline for each check.

## Automated tests

`pnpm test:browser` runs the web export in Chromium. `pnpm --filter example-expo build:native` bundles both native platforms with Metro, which shows the exports resolve; the checks above still need a device. `pnpm exec vitest run --project example-expo` runs the native Beacon against a fake `expo-updates` module, a fake `expo-application` and a fake key-value store, and `src/lab/sdk.contracts.ts` proves that the real `expo-application`, `expo-sqlite` and `AppState` types fit what the example passes them. [React Native](../../docs/react-native.md) is the page that explains the wiring.
