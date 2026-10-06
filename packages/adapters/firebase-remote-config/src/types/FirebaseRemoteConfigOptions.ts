import type { RemoteConfigLike } from "src/types/RemoteConfigLike";
import type { RemoteConfigModuleLike } from "src/types/RemoteConfigModuleLike";
import type { RemoteParameters } from "src/types/RemoteParameters";

/**
 * Options for `firebaseRemoteConfig()`. `remoteConfig` is the instance the
 * application already set up and `sdk` is the module that goes with it: the
 * application keeps its defaults and its fetch settings, and the source
 * configures neither. `document` builds the document from the activated
 * parameters and throws for what it cannot accept. `maxAge` is how many
 * milliseconds an answer holds after the fetch it came from, and is the SDK's
 * minimum fetch interval by default. `onFetchFailure` is `fail`, the default,
 * when a failed fetch fails the read, and `use-activated` when it answers with
 * the values activated earlier, which are then dated by their own fetch.
 *
 * @example
 * ```ts
 * import * as RemoteConfig from "firebase/remote-config";
 *
 * const options: FirebaseRemoteConfigOptions<
 *   RemoteConfig.RemoteConfig,
 *   { minimumBuild: string }
 * > = {
 *   remoteConfig: RemoteConfig.getRemoteConfig(),
 *   sdk: RemoteConfig,
 *   document: ({ remote }) => ({ minimumBuild: remote("minimum_build") }),
 *   onFetchFailure: "use-activated",
 * };
 * ```
 */
export type FirebaseRemoteConfigOptions<
  TRemoteConfig extends RemoteConfigLike,
  TDocument,
> = {
  name?: string;
  remoteConfig: TRemoteConfig;
  sdk: RemoteConfigModuleLike<TRemoteConfig>;
  document: (parameters: RemoteParameters) => TDocument;
  maxAge?: number;
  onFetchFailure?: "fail" | "use-activated";
};
