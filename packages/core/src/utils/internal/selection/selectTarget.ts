import type { NoneDecision } from "src/types/NoneDecision";
import type { ReleaseFacts } from "src/types/internal/ReleaseFacts";
import type { ReleaseSelection } from "src/types/ReleaseSelection";
import type { RunningRelease } from "src/types/RunningRelease";
import { compareIdentities } from "src/utils/compareIdentities";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import { inconclusive } from "src/utils/internal/selection/inconclusive";
import { noOffer } from "src/utils/internal/selection/noOffer";

type SelectTargetInput<TRelease extends ReleaseFacts> = {
  decision: { kind: "target"; release: TRelease } | NoneDecision;
  running: RunningRelease | null;
};

/** An authority names the release a scope should run; a different comparable identity is an offer, whatever its order. */
export const selectTarget = <TRelease extends ReleaseFacts>({
  decision,
  running,
}: SelectTargetInput<TRelease>): ReleaseSelection<TRelease> => {
  if (decision.kind === "none") {
    return noOffer<TRelease>("no-decision", null, decision.reason);
  }

  const { release } = decision;

  if (release.compatibility?.status === "incompatible") {
    return noOffer("incompatible", release);
  }

  if (running === null || running.identity.status === "unknown") {
    return inconclusive("missing-current-identity", release);
  }

  const relation = compareIdentities(running.identity, release.identity);

  if (relation === "incomparable") {
    return inconclusive("incomparable-identity", release);
  }

  if (relation === "same") {
    return noOffer("same-identity", release);
  }

  if (relation === "different") {
    return { status: "offer", release };
  }

  return assertUnreachable(relation);
};
