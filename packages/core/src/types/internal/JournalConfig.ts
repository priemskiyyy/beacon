import type { BeaconClock } from "src/types/BeaconClock";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { ResolvedJournalOptions } from "src/types/internal/ResolvedJournalOptions";
import type { Session } from "src/types/internal/Session";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RunningApplication } from "src/types/RunningApplication";
import type { Listeners } from "src/utils/internal/observable/Listeners";

/** What the journal is built from. */
export type JournalConfig = {
  /** `undefined` when the application configured no journal. */
  options: ResolvedJournalOptions | undefined;
  getScope: () => ReleaseScope;
  /** The running facts once every reader of the session has answered, failed or timed out. */
  getRunning: (session: Session) => Promise<RunningApplication>;
  clock: BeaconClock;
  listeners: Listeners;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};
