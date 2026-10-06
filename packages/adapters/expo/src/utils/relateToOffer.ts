import type { ReleaseIdentity } from "@priemskiyyy/beacon";

/** How what the provider prepared relates to the identity the user was shown: the same, another, or not comparable. */
export const relateToOffer = (
  prepared: ReleaseIdentity,
  offered: ReleaseIdentity,
) => {
  if (prepared.status === "unknown" || offered.status === "unknown") {
    return "unknown";
  }

  if (prepared.value === offered.value) {
    return "same";
  }

  return "different";
};
