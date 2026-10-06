import type { IdentityRelation } from "src/types/IdentityRelation";
import type { NoneDecision } from "src/types/NoneDecision";
import type { ReleaseFacts } from "src/types/internal/ReleaseFacts";
import type { ReleaseSelection } from "src/types/ReleaseSelection";
import type { RunningRelease } from "src/types/RunningRelease";
import type { VersionStrategy } from "src/types/VersionStrategy";
import { BeaconError } from "src/utils/BeaconError";
import { compareIdentities } from "src/utils/compareIdentities";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import { inconclusive } from "src/utils/internal/selection/inconclusive";
import { noOffer } from "src/utils/internal/selection/noOffer";
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
}: SelectNewerInput<TRelease, TParsed, TInput>): ReleaseSelection<TRelease> => {
  if (decision.kind === "none") {
    return noOffer<TRelease>("no-decision", null, decision.reason);
  }

  const { release } = decision;

  if (release.compatibility?.status === "incompatible") {
    return noOffer("incompatible", release);
  }

  if (currentOrder === null) {
    return inconclusive("missing-current-order", release);
  }

  const candidateOrder = runStrategy(version.name, () =>
    version.parse(release.order),
  );

  const parsedCurrentOrder = runStrategy(version.name, () =>
    version.parse(currentOrder),
  );

  if (!runStrategy(version.name, () => version.admits(candidateOrder))) {
    return noOffer("not-admitted", release);
  }

  const comparison = runStrategy(version.name, () =>
    version.compare(candidateOrder, parsedCurrentOrder),
  );

  if (comparison === "incomparable") {
    return inconclusive("incomparable-order", release);
  }

  const relation = relateToRunning(running, release);

  if (comparison === "equal" && relation === "different") {
    return noOffer("equal-order-different-identity", release);
  }

  if (comparison === "equal") {
    return noOffer("equal-order", release);
  }

  if (relation === "same") {
    throw new BeaconError({
      code: "IDENTITY_CONFLICT",
      message:
        "The candidate has the identity of what is running but a different order.",
    });
  }

  if (comparison === "older") {
    return noOffer("older-than-current", release);
  }

  if (comparison === "newer") {
    return { status: "offer", release };
  }

  return assertUnreachable(comparison);
};
