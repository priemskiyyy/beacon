import type { NativePlatform } from "src/types/NativePlatform";

/**
 * What an Android build number names: the version code of one published build,
 * and not its display name. It is the word the Play adapter names its offers
 * in, so the journal can tell that an update ran. The adapters cannot import
 * each other, so `vocabulary.test.ts` holds the two to the same word.
 */
export const ANDROID_DOMAIN = "android-version-code";

/** What an iOS build number names: `CFBundleVersion` of one build, and not its marketing version. The standard manifest and a support policy use the same word. */
export const IOS_DOMAIN = "ios-build";

/** What the build numbers of each platform name, unless the application says otherwise. */
export const DOMAINS: Record<NativePlatform, string> = {
  android: ANDROID_DOMAIN,
  ios: IOS_DOMAIN,
};
