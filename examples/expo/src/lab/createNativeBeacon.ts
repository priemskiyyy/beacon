import { Beacon, supportPolicy } from "@priemskiyyy/beacon";
import { createMockSource } from "@priemskiyyy/beacon/mock";
import { expoBundle, expoUpdates } from "@priemskiyyy/beacon-expo";
import type { UpdatesLike } from "@priemskiyyy/beacon-expo";

import { APPLICATION } from "example-shared/lab/constants/lab";
import { evaluateNativeSupport } from "src/lab/evaluateNativeSupport";
import type { NativeManifest } from "src/lab/types/NativeManifest";

type NativeBeaconOptions = {
  /** The `expo-updates` module the application imported; the adapter never imports it. */
  updates: UpdatesLike;
  platform: string;
  boot: { id: string };
};

/**
 * A real Beacon over Expo Updates. The OTA route belongs to the provider, and
 * the support policy reads the application's own manifest. That backend is a
 * mock source here, answering that no update has ended; in an application it is
 * `http()` from `@priemskiyyy/beacon-http` over the application's client.
 */
export const createNativeBeacon = ({
  updates,
  platform,
  boot,
}: NativeBeaconOptions) => {
  const manifest = createMockSource<NativeManifest>({
    name: "release-manifest",
  });

  manifest.answer({ document: { endedUpdates: [] } });

  return new Beacon({
    scope: {
      application: APPLICATION,
      environment: "production",
      platform,
      distribution: "expo-updates",
    },
    running: { boot, bundle: expoBundle(updates) },
    routes: { ota: expoUpdates({ updates }) },
    policy: supportPolicy({
      source: manifest.source.select((document) => document),
      evaluate: evaluateNativeSupport,
    }),
  });
};
