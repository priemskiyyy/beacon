/**
 * The part of a Remote Config instance the source reads: when the SDK last
 * fetched from the server, and how long it serves its own cache. Pass what
 * `getRemoteConfig()` returns, from `firebase/remote-config` or from
 * `@react-native-firebase/remote-config`. The source never sets anything on
 * it.
 *
 * @example
 * ```ts
 * import * as RemoteConfig from "firebase/remote-config";
 *
 * const remoteConfig: RemoteConfigLike = RemoteConfig.getRemoteConfig();
 * ```
 */
export type RemoteConfigLike = {
  /** Epoch milliseconds of the last successful fetch. The web and Android answer -1 when there was none, and iOS answers 0. */
  fetchTimeMillis: number;
  settings: {
    /** How long the SDK answers a fetch from its cache, without asking the server. */
    minimumFetchIntervalMillis: number;
  };
};
