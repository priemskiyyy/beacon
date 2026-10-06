import type { InconclusiveReason } from "src/types/InconclusiveReason";
import type { ReleaseSelection } from "src/types/ReleaseSelection";

/** A selection whose evidence cannot say whether the release is on offer, which is never read as up to date. */
export const inconclusive = <TRelease>(
  reason: InconclusiveReason,
  candidate: TRelease,
): ReleaseSelection<TRelease> => ({
  status: "inconclusive",
  reason,
  candidate,
});
