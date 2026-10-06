import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { BeaconError } from "src/utils/BeaconError";

/** How a feed tells its owner what happened, so every consumer of one source changes in one commit. */
export type FeedHooks = {
  /** A read began; everyone who consumes the source is checking. */
  started: (attempt: number) => void;
  /** A document was accepted or renewed, or its evidence expired. */
  accepted: (accepted: AcceptedFeed) => void;
  /** A read failed; the previous document, if any, stays. */
  failed: (attempt: number, error: BeaconError) => void;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};
