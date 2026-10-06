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
