import {
  ANDROID_VERSION_CODE_DOMAIN,
  IOS_BUILD_DOMAIN,
} from "@priemskiyyy/beacon";

import type { NativePlatform } from "src/types/NativePlatform";

/** Who assigns the ids of updates: the update server, whichever it is, so one authority names them all. */
export const UPDATE_AUTHORITY = "expo-updates";

/** What the ids name: one update, whether embedded or downloaded. */
export const UPDATE_DOMAIN = "update";

/**
 * What the build numbers of each platform name, unless the application says
 * otherwise: the version code of one published build on Android, which is the
 * word the Play adapter offers in, so the journal can tell that an update ran,
 * and `CFBundleVersion` of one build on iOS, and not its marketing version. The
 * words are the core's, so this package and the adapters that read them cannot
 * drift apart.
 */
export const BUILD_DOMAINS: Record<NativePlatform, string> = {
  android: ANDROID_VERSION_CODE_DOMAIN,
  ios: IOS_BUILD_DOMAIN,
};
