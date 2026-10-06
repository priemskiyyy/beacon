import type { BeaconErrorCode } from "src/types/BeaconErrorCode";

/** What accepting a decision revision means for the decision already held. */
export type RevisionVerdict =
  | { status: "accepted" }
  | { status: "renewed" }
  | {
      status: "rejected";
      code: Extract<
        BeaconErrorCode,
        "REVISION_REGRESSION" | "REVISION_CONFLICT" | "REVISION_EPOCH_CHANGED"
      >;
    };
