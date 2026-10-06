/** Why a command is unsupported, and why the running bundle has no identity: `expo-updates` is disabled, as in development or Expo Go. */
export const UPDATES_DISABLED = "updates-disabled";

/** Why the identity of the binary is unknown: the module gave no build number, or gave none that is text. */
export const BUILD_NOT_READ = "build-not-read";

/** Why the identity of the binary is unknown: the module gave no application id to name the authority. */
export const APPLICATION_NOT_READ = "application-not-read";

/** Why the identity of the binary is unknown: the scope is for a platform that has no build number of this kind, such as the web, so nothing was asked of the module. */
export const UNSUPPORTED_PLATFORM = "unsupported-platform";

/** Why the identity of the binary is unknown: it is another application than the one the authority names, as Expo Go running this code is. */
export const ANOTHER_APPLICATION = "another-application";
