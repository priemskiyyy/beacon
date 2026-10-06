import type { ApplicationLike } from "src/types/ApplicationLike";
import type { NativeReaderOptions } from "src/types/NativeReaderOptions";

/**
 * Options for `expoApplication()`: the `expo-application` module the
 * application imported, and the options every native reader takes.
 *
 * @example
 * ```ts
 * expoApplication({
 *   application: Application,
 *   platform: "android",
 *   authority: "com.example.notes",
 * });
 * ```
 */
export type ExpoApplicationOptions = NativeReaderOptions & {
  application: ApplicationLike;
};
