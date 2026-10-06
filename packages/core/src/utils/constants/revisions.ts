import type { RevisionVerdict } from "src/types/internal/RevisionVerdict";

/** What each rejected revision says to the person reading the error. */
export const REVISION_MESSAGES = {
  REVISION_REGRESSION:
    "A release source answered an older decision revision than the one held.",
  REVISION_CONFLICT:
    "A release source answered one decision revision with different content.",
  REVISION_EPOCH_CHANGED:
    "A release source answered a decision revision from another domain or epoch.",
} satisfies Record<
  Extract<RevisionVerdict, { status: "rejected" }>["code"],
  string
>;
