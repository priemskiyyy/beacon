import type {
  ObservationDraft,
  PreparedDraft,
} from "@priemskiyyy/beacon/adapter";

import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayPrepared } from "src/types/PlayPrepared";

/** What a query of Play says: the observation it stands for, and the download it found finished, or `null` when it says nothing of one. */
export type PlayReading = {
  observation: ObservationDraft<PlayOffer>;
  prepared: PreparedDraft<PlayPrepared> | null;
};
