import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { boundText } from "src/utils/boundText";

/** A release identity in one line: its value and who assigns it, or why it is unknown. */
export const formatIdentity = (identity: ReleaseIdentity) => {
  if (identity.status === "unknown") {
    return `unknown (${boundText(identity.reason)})`;
  }

  return `${boundText(identity.value)} (${boundText(identity.authority)}, ${boundText(identity.domain)})`;
};
