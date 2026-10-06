import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import { formatIdentity } from "src/formatting/formatIdentity";

/** An identity a fact may not have, or the words that say why not. */
export const formatOptionalIdentity = (
  identity: ReleaseIdentity | null,
  missing: string,
) => {
  if (identity === null) {
    return missing;
  }

  return formatIdentity(identity);
};
