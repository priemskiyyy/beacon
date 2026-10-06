import type { ApplicationLike } from "src/types/ApplicationLike";
import type { NativeReaderOptions } from "src/types/internal/NativeReaderOptions";

/**
 * Options for `expoApplication()`: the `expo-application` module the
 * application imported, and nothing else is needed. The platform, which decides
 * how the build number is named, is `scope.platform` (`"ios"` or `"android"`,
 * what `Platform.OS` says; any other scope is unknown, with the reason
 * `unsupported-platform`), and the authority is `scope.application`, so a
 * binary that reports another application id, as Expo Go does, is unknown with
 * the reason `another-application` and never named under yours. Give
 * `platform` or `authority` to override what the scope says, and `domain` for a
 * manifest that names its builds otherwise than `android-version-code` and
 * `ios-build`, the words the store adapters and the standard manifest use. An
 * authority or a domain that is given and is empty or has a space around it is
 * refused with `INVALID_CONFIGURATION`.
 *
 * @example
 * ```ts
 * expoApplication({ application: Application });
 * ```
 */
export type ExpoApplicationOptions = NativeReaderOptions & {
  application: ApplicationLike;
};
