import type { InconclusiveReason } from "src/types/InconclusiveReason";
import type { RouteBody } from "src/types/RouteBody";

/**
 * What a provider driver reports about its route. Beacon attaches the evidence
 * and mints the reference, so a driver cannot claim a reference it was never
 * given. A driver compares nothing with what runs, so its `none` is always
 * `no-decision`, and its `unknown` says the provider cannot run here: the
 * other reasons belong to Beacon's own selection and first state.
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
  | { status: "unknown"; reason: "unsupported-environment" }
  | { status: "none"; reason: "no-decision"; detail: string | null }
  | { status: "available"; offer: TOffer }
  | { status: "inconclusive"; reason: InconclusiveReason };
