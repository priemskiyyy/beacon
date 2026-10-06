import type { InconclusiveReason } from "src/types/InconclusiveReason";
import type { NoOfferReason } from "src/types/NoOfferReason";

/**
 * What selection decided about one release, before evidence is attached to it:
 * offer it, say why not, or say the evidence cannot tell.
 *
 * @example
 * ```ts
 * const selection: ReleaseSelection<Release> = { status: "offer", release };
 * ```
 */
export type ReleaseSelection<TRelease> =
  | { status: "offer"; release: TRelease }
  | {
      status: "none";
      reason: NoOfferReason;
      /** The authority's own reason code, for `no-decision`. */
      detail: string | null;
      candidate: TRelease | null;
    }
  | {
      status: "inconclusive";
      reason: InconclusiveReason;
      candidate: TRelease;
    };
