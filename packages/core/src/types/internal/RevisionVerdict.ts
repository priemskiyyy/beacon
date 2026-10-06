import type { BeaconErrorCode } from "src/types/BeaconErrorCode";

/** What accepting a decision revision means for the decision already held. */
export type RevisionVerdict =
  | { status: "accepted" }
  /** The same decision again; `digest` is the one that identifies it, whichever side had it. */
  | { status: "renewed"; digest: string | null }
  | {
      status: "rejected";
      code: Extract<
        BeaconErrorCode,
        | "INVALID_DOCUMENT"
        | "REVISION_REGRESSION"
        | "REVISION_CONFLICT"
        | "REVISION_EPOCH_CHANGED"
      >;
    };
