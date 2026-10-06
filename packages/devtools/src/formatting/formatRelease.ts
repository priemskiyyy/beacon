import type { Release } from "@priemskiyyy/beacon";

import { formatIdentity } from "src/formatting/formatIdentity";
import { boundText } from "src/utils/boundText";

/** A release in one line: its label when it has one, then its identity, or that there is none. */
export const formatRelease = (release: Release<object | null> | null) => {
  if (release === null) {
    return "none";
  }

  if (release.label === undefined) {
    return formatIdentity(release.identity);
  }

  return `${boundText(release.label)}, ${formatIdentity(release.identity)}`;
};
