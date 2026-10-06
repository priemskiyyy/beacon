import type { Comparison } from "@priemskiyyy/beacon";

import type { AppleVersion } from "src/types/AppleVersion";

/** Orders two marketing versions number by number from the major one down. */
export const compareAppleVersions = (
  candidate: AppleVersion,
  current: AppleVersion,
): Comparison => {
  for (const [index, part] of candidate.entries()) {
    const other = current[index] ?? 0;

    if (part === other) {
      continue;
    }

    if (part > other) {
      return "newer";
    }

    return "older";
  }

  return "equal";
};
