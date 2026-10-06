import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import {
  EMBEDDED_BUNDLE,
  PACKAGE_HASH_MISSING,
} from "src/utils/constants/reasons";

/** The identity of the bundle inside the binary: CodePush does not name it, so nothing identifies it. */
export const EMBEDDED_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: EMBEDDED_BUNDLE,
});

/** The identity of a package whose hash is missing or blank. */
export const MISSING_HASH_IDENTITY: ReleaseIdentity = Object.freeze({
  status: "unknown",
  reason: PACKAGE_HASH_MISSING,
});
