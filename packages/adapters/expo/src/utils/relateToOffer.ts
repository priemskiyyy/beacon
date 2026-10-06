import { compareIdentities } from "@priemskiyyy/beacon";
import type { ReleaseIdentity } from "@priemskiyyy/beacon";

/** How what the provider prepared relates to the identity the user was shown: the same, another, or not comparable. */
export const relateToOffer = (
  prepared: ReleaseIdentity,
  offered: ReleaseIdentity,
) => {
  const relation = compareIdentities(prepared, offered);

  if (relation === "incomparable") {
    return "unknown";
  }

  return relation;
};
