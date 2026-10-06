import type { IdentityRelation } from "src/types/IdentityRelation";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";

/**
 * Relates two identities without guessing: authority and domain are compared
 * before the value, and an unknown identity is incomparable with everything.
 *
 * @example
 * ```ts
 * const relation = compareIdentities(running.identity, offer.release.identity);
 *
 * if (relation === "different") {
 *   console.info("A different release is offered.");
 * }
 * ```
 */
export const compareIdentities = (
  left: ReleaseIdentity,
  right: ReleaseIdentity,
): IdentityRelation => {
  if (left.status === "unknown") {
    return "incomparable";
  }

  if (right.status === "unknown") {
    return "incomparable";
  }

  if (left.authority !== right.authority) {
    return "incomparable";
  }

  if (left.domain !== right.domain) {
    return "incomparable";
  }

  if (left.value === right.value) {
    return "same";
  }

  return "different";
};
