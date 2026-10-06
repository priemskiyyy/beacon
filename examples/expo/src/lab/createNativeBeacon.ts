import { Beacon, supportPolicy } from "@priemskiyyy/beacon";
import type {
  JournalOptions,
  JournalStorage,
  RunningReaders,
} from "@priemskiyyy/beacon";
import { createMockSource } from "@priemskiyyy/beacon/mock";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import type { UpdatesLike } from "@priemskiyyy/beacon-expo";
import { expoApplication } from "@priemskiyyy/beacon-native";
import type { ApplicationLike } from "@priemskiyyy/beacon-native";

import { evaluateNativeSupport } from "src/lab/evaluateNativeSupport";
import type { NativeManifest } from "src/lab/types/NativeManifest";

/** The application id of the binary, which `app.json` gives both stores. */
const NATIVE_APPLICATION = "dev.beacon.example";

type NativeBeaconOptions = {
  /** The `expo-updates` module the application imported; the adapter never imports it. */
  updates: UpdatesLike;
  platform: string;
  boot: { id: string };
  /** Where the journal keeps its record, which has to survive the reload it records. Without it the journal is off. */
  journal?: JournalStorage;
  /** The `expo-application` module, for the installed binary beside the running bundle. */
  application?: ApplicationLike;
};

const readRunning = ({
  updates,
  platform,
  boot,
  application,
}: NativeBeaconOptions): RunningReaders => {
  const running: RunningReaders = { boot, bundle: expoBundle(updates) };

  if (application === undefined) {
    return running;
  }

  if (platform !== "android" && platform !== "ios") {
    return running;
  }

  return {
    ...running,
    native: expoApplication({
      application,
      platform,
      authority: NATIVE_APPLICATION,
    }),
  };
};

const readJournal = (storage: JournalStorage | undefined) => {
  if (storage === undefined) {
    return {};
  }

  const journal: JournalOptions = { mode: "best-effort", storage };

  return { journal };
};

/**
 * A real Beacon over Expo Updates. The OTA route belongs to the provider, and
 * the support policy reads the application's own manifest. That backend is a
 * mock source here, answering that no update has ended; in an application it is
 * `http()` from `@priemskiyyy/beacon-http` over the application's client.
 */
export const createNativeBeacon = (options: NativeBeaconOptions) => {
  const manifest = createMockSource<NativeManifest>({
    name: "release-manifest",
  });

  manifest.answer({ document: { endedUpdates: [] } });

  return new Beacon({
    scope: {
      application: NATIVE_APPLICATION,
      environment: "production",
      platform: options.platform,
      distribution: "expo-updates",
    },
    running: readRunning(options),
    routes: { ota: expoUpdates({ updates: options.updates }) },
    policy: supportPolicy({
      source: manifest.source.select((document) => document),
      evaluate: evaluateNativeSupport,
    }),
    ...readJournal(options.journal),
  });
};
