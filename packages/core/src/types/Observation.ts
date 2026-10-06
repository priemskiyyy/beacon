import type { Evidence } from "src/types/Evidence";
import type { InconclusiveReason } from "src/types/InconclusiveReason";
import type { NoOfferReason } from "src/types/NoOfferReason";
import type { Offer } from "src/types/Offer";
import type { Release } from "src/types/Release";
import type { UnknownReason } from "src/types/UnknownReason";

/**
 * What a route has accepted about its authority. `none` means the authority
 * has nothing on offer for this route in this scope, not that no release
 * exists; `inconclusive` means the evidence cannot say, which is never "up to
 * date". A failed check leaves the last one in place and ages it.
 *
 * @example
 * ```ts
 * const { observation } = beacon.route("web").state.get();
 *
 * if (observation.status === "available") {
 *   showBanner(observation.offer.release.label);
 * }
 * ```
 */
export type Observation<
  TRoute extends string,
  TBody extends { release: Release<object | null> },
> =
  | { status: "unknown"; reason: UnknownReason }
  | {
      status: "none";
      evidence: Evidence;
      reason: NoOfferReason;
      /** The authority's own reason code for `no-decision`. */
      detail: string | null;
      candidate: TBody["release"] | null;
    }
  | { status: "available"; evidence: Evidence; offer: Offer<TRoute, TBody> }
  | {
      status: "inconclusive";
      evidence: Evidence;
      reason: InconclusiveReason;
      candidate: TBody["release"] | null;
    };
