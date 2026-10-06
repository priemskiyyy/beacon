import type { Evidence } from "src/types/Evidence";
import type { InconclusiveReason } from "src/types/InconclusiveReason";
import type { NoOfferReason } from "src/types/NoOfferReason";
import type { Offer } from "src/types/Offer";
import type { RouteBody } from "src/types/RouteBody";
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
export type Observation<TRoute extends string, TBody extends RouteBody> =
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
      /**
       * Why, in words, when the reason alone does not say. For
       * `missing-current-identity` it is the running reader's own reason, such
       * as `build-id-not-injected`, or `running-pending` while the reader has
       * not answered yet and `running-failed` once it failed. For
       * `incomparable-identity` it names the authority or the domain that
       * differs, with the running and the offered word of each, or the offered
       * identity that is unknown. `missing-current-order` says the same two
       * words when the running release is not there, and nothing when it is
       * there and has no order. The other order reasons have none.
       */
      detail: string | null;
      candidate: TBody["release"] | null;
    };
