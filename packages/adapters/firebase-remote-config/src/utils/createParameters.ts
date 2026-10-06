import { BeaconError } from "@priemskiyyy/beacon";

import type { RemoteConfigLike } from "src/types/RemoteConfigLike";
import type { RemoteConfigModuleLike } from "src/types/RemoteConfigModuleLike";
import type { RemoteParameters } from "src/types/RemoteParameters";
import { DEFAULT, MISSING, REMOTE } from "src/utils/constants/provenance";

/** The parameters of the values the SDK has activated now, which a fetch that just ran has dated. */
export const createParameters = <TRemoteConfig extends RemoteConfigLike>(
  sdk: RemoteConfigModuleLike<TRemoteConfig>,
  remoteConfig: TRemoteConfig,
): RemoteParameters => {
  const source = (key: string) => {
    const found = sdk.getValue(remoteConfig, key).getSource();

    if (found === REMOTE || found === DEFAULT) {
      return found;
    }

    return MISSING;
  };

  return {
    source,
    remote: (key) => {
      if (source(key) !== REMOTE) {
        throw new BeaconError({
          code: "SOURCE_FAILED",
          message: `Remote Config has no server value for "${key}".`,
        });
      }

      return sdk.getValue(remoteConfig, key).asString();
    },
  };
};
