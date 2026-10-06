import type { BeaconClock } from "src/types/BeaconClock";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { JournalOptions } from "src/types/JournalOptions";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { Listeners } from "src/utils/internal/observable/Listeners";

/** What the journal is built from. */
export type JournalConfig = {
  /** `undefined` when the application configured no journal. */
  options: JournalOptions | undefined;
  getScope: () => ReleaseScope;
  clock: BeaconClock;
  listeners: Listeners;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};
