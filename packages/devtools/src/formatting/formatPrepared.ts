import { formatIdentity } from "src/formatting/formatIdentity";
import type { ObservedRouteSnapshot } from "src/types/internal/ObservedRouteSnapshot";
import { assertUnreachable } from "src/utils/assertUnreachable";

/** What a provider reports ready, in one line. */
export const formatPrepared = (prepared: ObservedRouteSnapshot["prepared"]) => {
  if (
    prepared.status === "not-applicable" ||
    prepared.status === "unknown" ||
    prepared.status === "none"
  ) {
    return prepared.status;
  }

  if (prepared.status === "ready") {
    return `ready, ${formatIdentity(prepared.value.release.identity)}`;
  }

  return assertUnreachable(prepared);
};
