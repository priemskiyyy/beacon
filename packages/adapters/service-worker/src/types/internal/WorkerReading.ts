import type { ObservationDraft, PreparedDraft } from "@priemskiyyy/beacon";

import type { WorkerBody } from "src/types/WorkerBody";

/** What the workers of a registration say right now: whether an update is ready to activate, and whether one already activated. */
export type WorkerReading = {
  observation: ObservationDraft<WorkerBody>;
  prepared: PreparedDraft<WorkerBody>;
};
