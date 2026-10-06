import type { DecisionRevision } from "@priemskiyyy/beacon";

import { boundText } from "src/utils/boundText";

/** A decision revision in one line, or that the authority gave none. */
export const formatRevision = (revision: DecisionRevision | null) => {
  if (revision === null) {
    return "none";
  }

  if (revision.kind === "opaque") {
    return `opaque ${boundText(revision.value)}`;
  }

  return `${boundText(revision.domain)}/${boundText(revision.epoch)} #${boundText(revision.value)}`;
};
