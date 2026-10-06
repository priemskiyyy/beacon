import { BeaconError, createReleaseSource } from "@priemskiyyy/beacon";
import type { ReleaseSource } from "@priemskiyyy/beacon";

import type { FirebaseRemoteConfigOptions } from "src/types/FirebaseRemoteConfigOptions";
import type { RemoteConfigLike } from "src/types/RemoteConfigLike";
import { createParameters } from "src/utils/createParameters";

/**
 * Firebase Remote Config as a release source. A read fetches and activates,
 * which the SDK throttles to its minimum fetch interval, and answers a
 * document built from the activated parameters, good until the fetch that
 * produced them is older than `maxAge`. A key that came from the application's
 * defaults or from nowhere is never read as a server's answer, a configuration
 * that never fetched answers nothing, and Firebase exposes no template
 * version, so the answer names no revision and no issuer. The source never
 * configures the SDK and subscribes to nothing.
 *
 * @example
 * ```ts
 * import * as RemoteConfig from "firebase/remote-config";
 * import { integer } from "@priemskiyyy/beacon/versions";
 *
 * const build = integer();
 *
 * const config = firebaseRemoteConfig({
 *   remoteConfig: RemoteConfig.getRemoteConfig(),
 *   sdk: RemoteConfig,
 *   document: ({ remote }) => ({ minimumBuild: build.parse(remote("minimum_build")) }),
 * });
 * const minimumBuild = config.select((document) => document.minimumBuild);
 * ```
 */
export const firebaseRemoteConfig = <
  TRemoteConfig extends RemoteConfigLike,
  TDocument,
>({
  name = "firebase-remote-config",
  remoteConfig,
  sdk,
  document,
  maxAge,
  onFetchFailure = "fail",
}: FirebaseRemoteConfigOptions<
  TRemoteConfig,
  TDocument
>): ReleaseSource<TDocument> => {
  if (maxAge !== undefined && !(Number.isFinite(maxAge) && maxAge > 0)) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: "maxAge is a number of milliseconds above zero.",
    });
  }

  return createReleaseSource<TDocument>({
    name,
    read: async () => {
      // The values activated earlier are in the SDK's memory only after this, and so is the time of the fetch that got them.
      await sdk.ensureInitialized(remoteConfig);

      try {
        await sdk.fetchAndActivate(remoteConfig);
      } catch (cause) {
        if (onFetchFailure !== "use-activated") {
          throw cause;
        }
      }

      const { fetchTimeMillis, settings } = remoteConfig;

      // Only a fetch dates what is activated, and a configuration that never fetched holds nothing a server said.
      if (!(fetchTimeMillis > 0)) {
        throw new BeaconError({
          code: "SOURCE_FAILED",
          message:
            "Remote Config has never fetched, so its values are the application's defaults.",
        });
      }

      return {
        document: document(createParameters(sdk, remoteConfig)),
        expiresAt:
          fetchTimeMillis + (maxAge ?? settings.minimumFetchIntervalMillis),
      };
    },
  });
};
