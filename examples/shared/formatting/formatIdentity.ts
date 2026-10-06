import type { ReleaseIdentity } from "@priemskiyyy/beacon";

export const formatIdentity = (identity: ReleaseIdentity) => {
  if (identity.status === "unknown") {
    return `unknown (${identity.reason})`;
  }

  return identity.value;
};
