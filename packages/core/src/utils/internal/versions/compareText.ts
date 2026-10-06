import type { Ordering } from "src/types/internal/Ordering";

/** Orders two strings by their code units, which is ASCII order for a SemVer identifier. */
export const compareText = (candidate: string, current: string): Ordering => {
  if (candidate > current) {
    return "newer";
  }

  if (candidate < current) {
    return "older";
  }

  return "equal";
};
