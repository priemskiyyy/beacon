import type { CommandInput } from "src/types/internal/CommandInput";
import type { CommandResolution } from "src/types/internal/CommandResolution";
import type { CommandTarget } from "src/types/internal/CommandTarget";
import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { Offer } from "src/types/Offer";
import type { OfferReference } from "src/types/OfferReference";
import type { Prepared } from "src/types/Prepared";
import type { PreparedReference } from "src/types/PreparedReference";
import type { RouteBody } from "src/types/RouteBody";
import type { StaleReason } from "src/types/StaleReason";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import type { ReferenceLedger } from "src/utils/internal/routes/ReferenceLedger";

type Found<TValue> =
  { status: "found"; value: TValue } | { status: "stale"; reason: StaleReason };

const findOffer = (
  entry: RouteEntry,
  ledger: ReferenceLedger,
  reference: OfferReference<string> | undefined,
): Found<Offer<string, RouteBody>> => {
  if (
    reference === undefined ||
    !ledger.owns(reference) ||
    reference.route !== entry.name
  ) {
    return { status: "stale", reason: "foreign" };
  }

  const { observation } = entry.record.state.get();

  if (
    observation.status !== "available" ||
    observation.offer.ref !== reference
  ) {
    return { status: "stale", reason: "replaced" };
  }

  if (observation.evidence.freshness === "expired") {
    return { status: "stale", reason: "expired" };
  }

  return { status: "found", value: observation.offer };
};

const findPrepared = (
  entry: RouteEntry,
  ledger: ReferenceLedger,
  reference: PreparedReference<string> | undefined,
): Found<Prepared<string, RouteBody>> => {
  if (
    reference === undefined ||
    !ledger.owns(reference) ||
    reference.route !== entry.name
  ) {
    return { status: "stale", reason: "foreign" };
  }

  const { prepared } = entry.record.state.get();

  if (prepared.status !== "ready" || prepared.value.ref !== reference) {
    return { status: "stale", reason: "replaced" };
  }

  return { status: "found", value: prepared.value };
};

/**
 * Checks the references a call brought against what the route holds now, and
 * binds them into the call that runs the command. A reference Beacon did not
 * mint, or one of another route, is `foreign`; one that is no longer the
 * route's current is `replaced`; an offer whose evidence lapsed is `expired`.
 */
export const resolveCommand = (
  { entry, command }: CommandTarget,
  ledger: ReferenceLedger,
  input: CommandInput,
): CommandResolution => {
  if (command.reference === "none") {
    return {
      status: "resolved",
      reference: null,
      target: null,
      invoke: (base) => command.run(base),
    };
  }

  if (command.reference === "prepared") {
    const found = findPrepared(entry, ledger, input.prepared);

    if (found.status === "stale") {
      return found;
    }

    return {
      status: "resolved",
      reference: found.value.ref,
      target: found.value.release.identity,
      invoke: (base) => command.run({ ...base, prepared: found.value }),
    };
  }

  if (command.reference === "optional-offer" && input.offer === undefined) {
    return {
      status: "resolved",
      reference: null,
      target: null,
      invoke: (base) => command.run({ ...base, offer: null }),
    };
  }

  if (command.reference === "offer" || command.reference === "optional-offer") {
    const found = findOffer(entry, ledger, input.offer);

    if (found.status === "stale") {
      return found;
    }

    return {
      status: "resolved",
      reference: found.value.ref,
      target: found.value.release.identity,
      invoke: (base) => command.run({ ...base, offer: found.value }),
    };
  }

  return assertUnreachable(command);
};
