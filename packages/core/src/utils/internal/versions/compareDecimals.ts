import type { Ordering } from "src/types/internal/Ordering";

/** Orders two canonical decimal strings exactly, whatever their size. */
export const compareDecimals = (
  candidate: string,
  current: string,
): Ordering => {
  if (candidate.length > current.length) {
    return "newer";
  }

  if (candidate.length < current.length) {
    return "older";
  }

  if (candidate > current) {
    return "newer";
  }

  if (candidate < current) {
    return "older";
  }

  return "equal";
};
