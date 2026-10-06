/** Why the identity is unknown: the SDK gave no build number, or gave none that is text. */
export const BUILD_NOT_READ = "build-not-read";

/** Why the identity is unknown: the SDK gave no application id to name the authority. */
export const APPLICATION_NOT_READ = "application-not-read";

/** Why the identity is unknown: the scope is for a platform that has no build number of this kind, such as the web, so nothing was asked of the SDK. */
export const UNSUPPORTED_PLATFORM = "unsupported-platform";

/** Why the identity is unknown: the binary is another application than the one the authority names, as Expo Go running this code is. */
export const ANOTHER_APPLICATION = "another-application";
