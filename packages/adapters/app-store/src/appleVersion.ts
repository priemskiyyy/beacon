import { custom } from "@priemskiyyy/beacon/versions";

import type { AppleVersion } from "src/types/AppleVersion";
import { compareAppleVersions } from "src/utils/compareAppleVersions";
import { parseAppleVersion } from "src/utils/parseAppleVersion";

/**
 * The marketing version order of the App Store: one to three numbers, missing
 * ones zero, so `3.2` equals `3.2.0`. It orders marketing releases only. A
 * native build number is another domain, and a marketing version can never
 * satisfy a build-level requirement.
 *
 * @example
 * ```ts
 * newerRoute({ subject: "native", source, version: appleVersion(), current: appleMarketingVersion, mechanism });
 * ```
 */
export const appleVersion = () =>
  custom<AppleVersion, string>({
    name: "apple-marketing-version",
    parse: parseAppleVersion,
    compare: compareAppleVersions,
  });
