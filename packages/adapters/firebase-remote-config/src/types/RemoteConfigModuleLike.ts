import type { RemoteValueLike } from "src/types/RemoteValueLike";

/**
 * The modular functions of a Remote Config SDK the source calls, each taking
 * that SDK's own instance. Pass the module namespace of
 * `firebase/remote-config` on the web, or of
 * `@react-native-firebase/remote-config` in React Native. The source never
 * imports either, so a test passes a fake, and the functions of one SDK never
 * accept the instance of the other.
 *
 * @example
 * ```ts
 * import * as RemoteConfig from "@react-native-firebase/remote-config";
 *
 * const sdk: RemoteConfigModuleLike<RemoteConfig.RemoteConfig> = RemoteConfig;
 * ```
 */
export type RemoteConfigModuleLike<TRemoteConfig> = {
  ensureInitialized: (remoteConfig: TRemoteConfig) => Promise<void>;
  fetchAndActivate: (remoteConfig: TRemoteConfig) => Promise<boolean>;
  getValue: (remoteConfig: TRemoteConfig, key: string) => RemoteValueLike;
};
