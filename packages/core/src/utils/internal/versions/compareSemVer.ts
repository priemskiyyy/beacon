import type { Ordering } from "src/types/internal/Ordering";
import type { SemVer } from "src/types/SemVer";
import type { SemVerIdentifier } from "src/types/SemVerIdentifier";
import { compareDecimals } from "src/utils/internal/versions/compareDecimals";
import { compareText } from "src/utils/internal/versions/compareText";

const compareIdentifiers = (
  candidate: SemVerIdentifier,
  current: SemVerIdentifier,
): Ordering => {
  if (candidate.kind === "numeric" && current.kind === "numeric") {
    return compareDecimals(candidate.value, current.value);
  }

  // A numeric identifier always has lower precedence than a text one.
  if (candidate.kind === "numeric") {
    return "older";
  }

  if (current.kind === "numeric") {
    return "newer";
  }

  return compareText(candidate.value, current.value);
};

const comparePrereleases = (
  candidate: SemVerIdentifier[],
  current: SemVerIdentifier[],
): Ordering => {
  // A version without a prerelease outranks the same version with one.
  if (candidate.length === 0 && current.length === 0) {
    return "equal";
  }

  if (candidate.length === 0) {
    return "newer";
  }

  if (current.length === 0) {
    return "older";
  }

  for (const [index, candidateIdentifier] of candidate.entries()) {
    const currentIdentifier = current[index];

    if (currentIdentifier === undefined) {
      break;
    }

    const ordering = compareIdentifiers(candidateIdentifier, currentIdentifier);

    if (ordering === "equal") {
      continue;
    }

    return ordering;
  }

  // Every shared identifier is equal, so the longer prerelease has the higher precedence.
  if (candidate.length > current.length) {
    return "newer";
  }

  if (candidate.length < current.length) {
    return "older";
  }

  return "equal";
};

/** Orders by precedence as SemVer 2.0.0 defines it; build metadata never counts. */
export const compareSemVer = (candidate: SemVer, current: SemVer): Ordering => {
  const major = compareDecimals(candidate.major, current.major);

  if (major !== "equal") {
    return major;
  }

  const minor = compareDecimals(candidate.minor, current.minor);

  if (minor !== "equal") {
    return minor;
  }

  const patch = compareDecimals(candidate.patch, current.patch);

  if (patch !== "equal") {
    return patch;
  }

  return comparePrereleases(candidate.prerelease, current.prerelease);
};
