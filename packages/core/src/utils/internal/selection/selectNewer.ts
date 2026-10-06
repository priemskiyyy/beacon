import type { IdentityRelation } from "src/types/IdentityRelation";
import type { NoneDecision } from "src/types/NoneDecision";
import type { ReleaseFacts } from "src/types/internal/ReleaseFacts";
import type { Selection } from "src/types/internal/Selection";
import type { RunningRelease } from "src/types/RunningRelease";
import type { VersionStrategy } from "src/types/VersionStrategy";
import { BeaconError } from "src/utils/BeaconError";
import { compareIdentities } from "src/utils/compareIdentities";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import { runStrategy } from "src/utils/internal/selection/runStrategy";

const relateToRunning = (
  running: RunningRelease | null,
  release: ReleaseFacts,
): IdentityRelation => {
  if (running === null) {
    return "incomparable";
  }

  return compareIdentities(running.identity, release.identity);
};

type SelectNewerInput<
  TRelease extends ReleaseFacts & { order: TInput },
  TParsed,
  TInput,
> = {
  decision: { kind: "candidate"; release: TRelease } | NoneDecision;
  running: RunningRelease | null;
  /** The order of what is running, or `null` when its reader cannot say. */
  currentOrder: TInput | null;
  version: VersionStrategy<TParsed, TInput>;
};

/** An authority names a candidate; only an admitted one that orders newer than what is running is an offer. */
export const selectNewer = <
  TRelease extends ReleaseFacts & { order: TInput },
  TParsed,
  TInput,
>({
  decision,
  running,
  currentOrder,
  version,
}: SelectNewerInput<TRelease, TParsed, TInput>): Selection<TRelease> => {
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

  if (currentOrder === null) {
    return {
      status: "inconclusive",
      reason: "missing-current-order",
      candidate: release,
    };
  }

  const candidateOrder = runStrategy(version.name, () =>
    version.parse(release.order),
  );

  const parsedCurrentOrder = runStrategy(version.name, () =>
    version.parse(currentOrder),
  );

  if (!runStrategy(version.name, () => version.admits(candidateOrder))) {
    return {
      status: "none",
      reason: "not-admitted",
      detail: null,
      candidate: release,
    };
  }

  const comparison = runStrategy(version.name, () =>
    version.compare(candidateOrder, parsedCurrentOrder),
  );

  if (comparison === "incomparable") {
    return {
      status: "inconclusive",
      reason: "incomparable-order",
      candidate: release,
    };
  }

  const relation = relateToRunning(running, release);

  if (comparison === "equal" && relation === "different") {
    return {
      status: "none",
      reason: "equal-order-different-identity",
      detail: null,
      candidate: release,
    };
  }

  if (comparison === "equal") {
    return {
      status: "none",
      reason: "equal-order",
      detail: null,
      candidate: release,
    };
  }

  if (relation === "same") {
    throw new BeaconError({
      code: "IDENTITY_CONFLICT",
      message:
        "The candidate has the identity of what is running but a different order.",
    });
  }

  if (comparison === "older") {
    return {
      status: "none",
      reason: "older-than-current",
      detail: null,
      candidate: release,
    };
  }

  if (comparison === "newer") {
    return { status: "offer", release };
  }

  return assertUnreachable(comparison);
};
