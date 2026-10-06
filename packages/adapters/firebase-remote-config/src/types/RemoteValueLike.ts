/**
 * One parameter as the SDK reports it. `getSource()` says where the text came
 * from: `remote` for what the server sent and was activated, `default` for
 * the application's own defaults, `static` for a key nothing defines. It is
 * typed as text because the native iOS module can also answer `unknown`, and
 * only `remote` is ever taken for a server's answer.
 *
 * @example
 * ```ts
 * import * as RemoteConfig from "firebase/remote-config";
 *
 * const value: RemoteValueLike = RemoteConfig.getValue(
 *   RemoteConfig.getRemoteConfig(),
 *   "minimum_build",
 * );
 * ```
 */
export type RemoteValueLike = {
  asString(): string;
  getSource(): string;
};
