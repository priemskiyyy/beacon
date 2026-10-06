/**
 * What an Android build number names: the version code of one published build,
 * and not its display name. The Play adapter offers in this word, the native
 * readers name the running binary in it, and `minimumBuild` reads it.
 */
export const ANDROID_VERSION_CODE_DOMAIN = "android-version-code";

/** What an iOS build number names: the `CFBundleVersion` of one build, and not its marketing version. The native readers, the standard manifest and `minimumBuild` use the same word. */
export const IOS_BUILD_DOMAIN = "ios-build";

/** What the id of a web build names: the artifact the bundler produced. The browser adapter's reader, the standard manifest and a support policy use the same word. */
export const WEB_ARTIFACT_DOMAIN = "web-artifact";
