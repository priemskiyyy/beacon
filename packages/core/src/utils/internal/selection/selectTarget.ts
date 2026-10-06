import type { NoneDecision } from "src/types/NoneDecision";
import type { ReleaseFacts } from "src/types/internal/ReleaseFacts";
import type { Selection } from "src/types/internal/Selection";
import type { RunningRelease } from "src/types/RunningRelease";
import { compareIdentities } from "src/utils/compareIdentities";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";

type SelectTargetInput<TRelease extends ReleaseFacts> = {
  decision: { kind: "target"; release: TRelease } | NoneDecision;
  running: RunningRelease | null;
};

/** An authority names the release a scope should run; a different comparable identity is an offer, whatever its order. */
export const selectTarget = <TRelease extends ReleaseFacts>({
  decision,
  running,
}: SelectTargetInput<TRelease>): Selection<TRelease> => {
  if (decision.kind === "none") {
    return {
      status: "none",
      reason: "no-decision",
      detail: decision.reason,
      candidate: null,
    };
  }

  const { release } = decision;

  if (release.compatibility?.status === "incompatible") {
    return {
      status: "none",
      reason: "incompatible",
      detail: null,
      candidate: release,
    };
  }

  if (running === null || running.identity.status === "unknown") {
    return {
      status: "inconclusive",
      reason: "missing-current-identity",
      candidate: release,
    };
  }

  const relation = compareIdentities(running.identity, release.identity);

  if (relation === "incomparable") {
    return {
      status: "inconclusive",
      reason: "incomparable-identity",
      candidate: release,
    };
  }

  if (relation === "same") {
    return {
      status: "none",
      reason: "same-identity",
      detail: null,
      candidate: release,
    };
  }

  if (relation === "different") {
    return { status: "offer", release };
  }

  return assertUnreachable(relation);
};
