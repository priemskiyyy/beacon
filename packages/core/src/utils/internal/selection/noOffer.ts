import type { NoOfferReason } from "src/types/NoOfferReason";
import type { ReleaseSelection } from "src/types/ReleaseSelection";

/** A selection with nothing to offer, and the release it was about, if it names one. `detail` is the authority's own reason code, kept only for `no-decision`. */
export const noOffer = <TRelease>(
  reason: NoOfferReason,
  candidate: TRelease | null,
  detail: string | null = null,
): ReleaseSelection<TRelease> => ({
  status: "none",
  reason,
  detail,
  candidate,
});
