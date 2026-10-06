import type { NativePlatform } from "src/types/NativePlatform";

/**
 * What every native reader takes besides its SDK. `platform` says which build
 * number space the binary is in. `authority` is the application id the route
 * offers for, which is `scope.application`: the reader then says
 * `another-application` for a binary that reports another id, as Expo Go does,
 * and never names its build numbers under yours. Left out, the authority is
 * the id the binary reports and nothing is checked. `domain` is what the build
 * numbers name: `android-version-code` or `ios-build`, the words the store
 * adapters and the standard manifest use, so change it only for a manifest of
 * your own that names them otherwise. Both are text with no space around it,
 * or the reader is refused with `INVALID_CONFIGURATION`.
 *
 * @example
 * ```ts
 * const options: NativeReaderOptions = {
 *   platform: "android",
 *   authority: "com.example.notes",
 * };
 * ```
 */
export type NativeReaderOptions = {
  platform: NativePlatform;
  authority?: string;
  domain?: string;
};
