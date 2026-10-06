import type {
  BeaconDiagnosticEvent,
  TransitionState,
} from "@priemskiyyy/beacon";

import type { WorldEvent } from "example-shared/lab/types/WorldEvent";

export type TimelineBody =
  | { source: "diagnostic"; event: BeaconDiagnosticEvent }
  | { source: "transition"; state: TransitionState }
  | { source: "world"; event: WorldEvent };
