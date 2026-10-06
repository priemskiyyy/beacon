import type { InconclusiveReason } from "src/types/InconclusiveReason";
import type { NoOfferReason } from "src/types/NoOfferReason";

/** What selection decided about one release, before evidence is attached. */
export type Selection<TRelease> =
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
