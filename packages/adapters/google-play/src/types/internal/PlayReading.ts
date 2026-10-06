import type { ObservationDraft, Release } from "@priemskiyyy/beacon";

import type { PlayInstallStatus } from "src/types/PlayInstallStatus";
import type { PlayOffer } from "src/types/PlayOffer";

/** What a query of Play said: the observation it stands for and, when it named a release, that release with where the install stands. */
export type PlayReading = {
  observation: ObservationDraft<PlayOffer>;
} & (
  | { release: null; installStatus: null }
  | { release: Release; installStatus: PlayInstallStatus }
);
