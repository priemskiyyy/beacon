import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { VERSION_CODE_DOMAIN } from "src/utils/constants/authority";

/** The identity of one published build, by the version code Play orders builds with, under the application that publishes it. */
export const createVersionIdentity = (
  application: string,
  versionCode: number,
): ReleaseIdentity => ({
  status: "known",
  authority: application,
  domain: VERSION_CODE_DOMAIN,
  value: String(versionCode),
});
