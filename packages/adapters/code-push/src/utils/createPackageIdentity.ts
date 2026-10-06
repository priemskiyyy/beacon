import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import {
  PACKAGE_AUTHORITY,
  PACKAGE_DOMAIN,
} from "src/utils/constants/authority";
import { MISSING_HASH_IDENTITY } from "src/utils/constants/identities";

/** The identity of one package, by the hash of its release, kept as CodePush wrote it since its native side compares it as text. A hash that is missing, empty or blank names nothing: a server's answer can omit it, though the type says it is there. */
export const createPackageIdentity = (hash: string): ReleaseIdentity => {
  if (typeof hash !== "string" || hash.trim() === "") {
    return MISSING_HASH_IDENTITY;
  }

  return {
    status: "known",
    authority: PACKAGE_AUTHORITY,
    domain: PACKAGE_DOMAIN,
    value: hash,
  };
};
