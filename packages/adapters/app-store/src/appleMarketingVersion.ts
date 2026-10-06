import type { RunningRelease } from "@priemskiyyy/beacon";

import { SHORT_VERSION_KEY } from "src/utils/constants/lookup";

/**
 * The marketing version of what is running, read from the `shortVersion` fact
 * of its native release, which holds `CFBundleShortVersionString`. The build
 * number stays a separate fact. Without it the order of what runs is unknown,
 * so no route claims a newer version.
 *
 * @example
 * ```ts
 * newerRoute({ subject: "native", source, version: appleVersion(), current: appleMarketingVersion, mechanism });
 * ```
 */
export const appleMarketingVersion = (release: RunningRelease | null) => {
  const shortVersion = release?.raw[SHORT_VERSION_KEY];

  if (typeof shortVersion !== "string") {
    return null;
  }

  return shortVersion;
};
