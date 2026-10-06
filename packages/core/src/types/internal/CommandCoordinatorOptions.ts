import type { BeaconError } from "src/utils/BeaconError";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { Session } from "src/types/internal/Session";
import type { DisruptionRegistry } from "src/utils/internal/disruptions/DisruptionRegistry";
import type { ReferenceLedger } from "src/utils/internal/routes/ReferenceLedger";

/** What the command coordinator is built from. */
export type CommandCoordinatorOptions = {
  ledger: ReferenceLedger;
  disruptions: DisruptionRegistry;
  getSession: () => Session | null;
  /** Why a call outside a session cannot run: the Beacon is disposed, or was never started. */
  createInactiveError: () => BeaconError;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};
