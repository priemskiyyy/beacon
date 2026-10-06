# Notes, Beacon in an Expo app

The smallest Expo app that does what [React Native](../../docs/react-native.md) teaches: it offers an OTA update in a banner, never reloads over a note that is not saved, and shows a forced-upgrade screen when the installed build is too old. Five files and an entry point, with no shared code and nothing from `@priemskiyyy/beacon/mock` or `/testing`. Copy it. The [Expo lab](../expo-lab/README.md) next to it is the release lab the tests use, not the way to start.

```sh
pnpm install
pnpm build
pnpm --filter example-expo dev
```

The packages are linked from the workspace, so build them first. In an application of your own, install what the page lists: `pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react @priemskiyyy/beacon-expo @priemskiyyy/beacon-app-store @priemskiyyy/beacon-google-play`, and `npx expo install expo-updates expo-application`. The last two packages are only for the forced upgrade's store button.

## The files

| File                    | What it does                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/beacon.ts`         | The Beacon: the scope, the `ota` route from `expoUpdates`, the installed build from `expoApplication`, the `store` route (`appStore` on iOS, `playStore` on Android), the `minimumBuild` policy and the `Register` line. |
| `src/App.tsx`           | `BeaconProvider`, which starts the session, and `checkOn` with `foreground({ appState })`, which also checks when the app starts.                                                                                        |
| `src/UpdateBanner.tsx`  | `useRoute("ota")` and `applyUpdate`: the banner shows while an update is on offer, and says why when the update is blocked.                                                                                              |
| `src/DraftForm.tsx`     | The guard: `useDisruption` answers `blocked` while the note is not saved, so a reload cannot reach it.                                                                                                                   |
| `src/ForcedUpgrade.tsx` | `useSupport`: below the minimum build it replaces the app with a button that calls `openStore` on the `store` route.                                                                                                     |
| `index.ts`              | `registerRootComponent`.                                                                                                                                                                                                 |

[React Native](../../docs/react-native.md) explains these files one after another, and its code is these files. When the page and a file disagree, the file is right: it is compiled, bundled and tested.

## Seeing it

In development (`__DEV__`) the `ota` route runs on `createFakeUpdates({ available: true })` from `@priemskiyyy/beacon-expo/mock`, which offers one update, so the banner shows in Expo Go and in a development build, where `expo-updates` is disabled. The fake is about a kilobyte in the bundle, and a release build uses the real `expo-updates` module. The update server of a release build is yours: `npx eas update:configure` adds the update URL and the runtime version.

The forced upgrade reads its minimum from a constant in `src/beacon.ts`, 120, which is the build number in `app.json`. Raise it above that and the next check shows the screen on a build of this app. In Expo Go the binary is another application's, which Beacon reads as unknown, never as too old, so Expo Go never shows it.

## Tests

`pnpm exec vitest run --project example-expo` renders the app against a fake `expo-updates` (the one of the adapter), a fake `expo-application` and a fake `Linking`, with the platform set to Android unless a test says iOS, and checks these:

- an update on offer is a banner, and `Update` downloads it and reloads;
- a note that is not saved blocks the update, and saving lets it through;
- a build below the minimum shows the forced upgrade, and its button opens the store;
- on iOS the same button opens the App Store page of the app, which the test stubs the lookup for;
- a build at the minimum runs the app;
- Expo Go, where updates are disabled and the binary is another app, says nothing.

The React Native components render through `react-native-web` in jsdom, so the tests show what the wiring does and nothing about how it looks. `pnpm --filter example-expo build:native` bundles the app for iOS and Android with Metro and compiles it to Hermes bytecode, which shows that the packages' exports resolve in a native bundle. Nothing here has run on a device: [what no device has run](../../docs/react-native.md#what-no-device-has-run) lists what a device still has to show.
