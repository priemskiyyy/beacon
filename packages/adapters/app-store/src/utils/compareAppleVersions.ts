import type { Comparison } from "@priemskiyyy/beacon";

import type { AppleVersion } from "src/types/AppleVersion";

/** Orders two marketing versions number by number from the major one down. */
export const compareAppleVersions = (
  candidate: AppleVersion,
  current: AppleVersion,
): Comparison => {
  // The first number that differs decides; each has at most nine digits, so the difference is exact.
  const difference =
    candidate[0] - current[0] ||
    candidate[1] - current[1] ||
    candidate[2] - current[2];

  if (difference > 0) {
    return "newer";
  }

  if (difference < 0) {
    return "older";
  }

  return "equal";
};
