import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { Session } from "src/types/internal/Session";
import type { BeaconError } from "src/utils/BeaconError";

/** How a shared read tells its owner what happened, so everyone who consumes it changes in one commit. */
export type SharedReadHooks<TAccepted> = {
  /** A read began. */
  started: (attempt: number) => void;
  /** The read's answer was accepted; called before any waiter is told. */
  accepted: (attempt: number, accepted: TAccepted, session: Session) => void;
  /** The read failed, timed out or was abandoned; whatever was held stays. */
  failed: (attempt: number, error: BeaconError) => void;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};
