import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { Session } from "src/types/internal/Session";
import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningSubject } from "src/types/RunningSubject";
import type { DisruptionRegistry } from "src/utils/internal/disruptions/DisruptionRegistry";
import type { Journal } from "src/utils/internal/journal/Journal";
import type { ReferenceLedger } from "src/utils/internal/routes/ReferenceLedger";

/** What the command coordinator is built from. */
export type CommandCoordinatorOptions = {
  ledger: ReferenceLedger;
  disruptions: DisruptionRegistry;
  /** Where the intent of a command that replaces the realm is written before it is dispatched. */
  journal: Journal;
  getRunning: () => RunningApplication;
  /** Resolves once the reader of a subject has answered, failed or timed out for the session, or the session ended; it never rejects. */
  waitForRunning: (session: Session, subject: RunningSubject) => Promise<void>;
  getSession: () => Session | null;
  /** Epoch milliseconds, for judging whether an offer's evidence still holds. */
  now: () => number;
  /** Why a call outside a session cannot run: the Beacon is disposed, or was never started. */
  createInactiveError: () => BeaconErrorInfo;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};
