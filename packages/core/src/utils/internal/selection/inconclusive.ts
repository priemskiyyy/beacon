import type { InconclusiveReason } from "src/types/InconclusiveReason";
import type { ReleaseSelection } from "src/types/ReleaseSelection";

/** A selection whose evidence cannot say whether the release is on offer, which is never read as up to date. `detail` says why, when the reason alone does not. */
export const inconclusive = <TRelease>(
  reason: InconclusiveReason,
  candidate: TRelease,
  detail: string | null = null,
): ReleaseSelection<TRelease> => ({
  status: "inconclusive",
  reason,
  detail,
  candidate,
});
