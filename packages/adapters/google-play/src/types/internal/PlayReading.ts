import type { ObservationDraft, Release } from "@priemskiyyy/beacon";

import type { PlayInstallStatus } from "src/types/PlayInstallStatus";
import type { PlayOffer } from "src/types/PlayOffer";

/** What a query of Play said: the observation it stands for, the release it named if any, and where the install stands. */
export type PlayReading = {
  observation: ObservationDraft<PlayOffer>;
  release: Release | null;
  installStatus: PlayInstallStatus | null;
};
