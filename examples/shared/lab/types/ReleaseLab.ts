import type { ObservableValue } from "@priemskiyyy/beacon";

import type { LabBoot } from "example-shared/lab/types/LabBoot";
import type { LabControls } from "example-shared/lab/types/LabControls";
import type { LabDraft } from "example-shared/lab/types/LabDraft";
import type { LabWorld } from "example-shared/lab/types/LabWorld";
import type { TimelineEntry } from "example-shared/lab/types/TimelineEntry";
import type { EventLog } from "example-shared/types/EventLog";

export type ReleaseLab = {
  /** The document that runs now. A reload boots another, and a new Beacon starts from the same journal. */
  boot: ObservableValue<LabBoot>;
  world: ObservableValue<LabWorld>;
  draft: ObservableValue<LabDraft>;
  /** Beacon's diagnostics, the journal's state and the world's changes, newest first. */
  timeline: EventLog<TimelineEntry>;
  controls: LabControls;
  dispose: () => void;
};
