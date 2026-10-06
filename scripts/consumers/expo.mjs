// An Expo application over the packed packages, with the real `expo-updates`,
// `expo-application`, `react-native` and `react` from npm: the React Native setup
// of the documentation, compiled against the packed declarations with the Expo
// preset's own tsconfig, and bundled by Metro for both native platforms.
export const EXPO_PACKAGES = [
  "@priemskiyyy/beacon",
  "@priemskiyyy/beacon-react",
  "@priemskiyyy/beacon-expo",
];

export const expoFiles = {
  "app.json": `{
  "expo": {
    "name": "Beacon consumer",
    "slug": "beacon-consumer",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "ios": { "bundleIdentifier": "com.example.notes" },
    "android": { "package": "com.example.notes" }
  }
}
`,

  "tsconfig.json": `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true
  },
  "include": ["index.ts", "src"]
}
`,

  "index.ts": `import { registerRootComponent } from "expo";

import { App } from "./src/App";

registerRootComponent(App);
`,

  "src/beacon.ts": `import { Beacon } from "@priemskiyyy/beacon";
import { expoApplication, expoUpdates } from "@priemskiyyy/beacon-expo";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: Platform.OS,
    distribution: "app-store",
  },
  running: { native: expoApplication({ application: Application }) },
  routes: { ota: expoUpdates({ updates: Updates }) },
});

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
`,

  "src/updates.ts": `import { checkOn, foreground } from "@priemskiyyy/beacon/triggers";
import { applyUpdate } from "@priemskiyyy/beacon-expo";
import { AppState } from "react-native";

import { beacon } from "./beacon";

export const startUpdates = () => {
  const stop = beacon.start();

  const stopChecking = checkOn(beacon, {
    triggers: [foreground({ appState: AppState })],
  });

  return () => {
    stopChecking();
    stop();
  };
};

export const update = () => applyUpdate(beacon.route("ota"));
`,

  "src/App.tsx": `import { BeaconProvider, useRoute } from "@priemskiyyy/beacon-react";
import { Pressable, Text, View } from "react-native";

import { beacon } from "./beacon";
import { update } from "./updates";

const Banner = () => {
  const observation = useRoute("ota", (snapshot) => snapshot.observation);

  if (observation.status !== "available") {
    return null;
  }

  return (
    <Pressable
      onPress={() => {
        update();
      }}
    >
      <Text>Update</Text>
    </Pressable>
  );
};

export const App = () => (
  <BeaconProvider beacon={beacon}>
    <View>
      <Banner />
    </View>
  </BeaconProvider>
);
`,

  // What the compiler must refuse, proved from the packed declarations and the real SDK's types.
  "src/contracts.ts": `import type { RunningReaders } from "@priemskiyyy/beacon";
import { expoApplication, expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import { createFakeUpdates } from "@priemskiyyy/beacon-expo/mock";
import * as Application from "expo-application";
import * as Updates from "expo-updates";

import { beacon } from "./beacon";

export const readers: RunningReaders = {
  native: expoApplication({ application: Application }),
  bundle: expoBundle({ updates: Updates }),
};

export const route = expoUpdates({ updates: createFakeUpdates({ available: true }) });

// @ts-expect-error -- a module is the SDK's, not a random object.
expoUpdates({ updates: {} });

// @ts-expect-error -- the route's commands are the ones the mechanism declares.
beacon.route("ota").restart({});

// @ts-expect-error -- "nope" is not a route of the registered Beacon.
beacon.route("nope");
`,
};

// The installed tree of the consumer proves its own peers; Metro proves the exports.
export const expoMetroEnvironment = {
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
  EXPO_OFFLINE: "1",
  EXPO_NO_GIT_STATUS: "1",
};
