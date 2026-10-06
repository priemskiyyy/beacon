import type { InconclusiveReason } from "src/types/InconclusiveReason";
import type { NoOfferReason } from "src/types/NoOfferReason";
import type { RouteBody } from "src/types/RouteBody";
import type { UnknownReason } from "src/types/UnknownReason";

/**
 * What a provider driver reports about its route. Beacon attaches the evidence
 * and mints the reference, so a driver cannot claim a reference it was never
 * given.
 *
 * @example
 * ```ts
 * const draft: ObservationDraft<PlayOffer> = {
 *   status: "available",
 *   offer: { release, flows: ["flexible"] },
 * };
 * ```
 */
export type ObservationDraft<TOffer extends RouteBody> =
  | { status: "unknown"; reason: UnknownReason }
  | { status: "none"; reason: NoOfferReason; detail: string | null }
  | { status: "available"; offer: TOffer }
  | { status: "inconclusive"; reason: InconclusiveReason };
