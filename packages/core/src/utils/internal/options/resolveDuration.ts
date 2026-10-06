import { BeaconError } from "src/utils/BeaconError";

/** A duration option as a positive whole number of milliseconds, or its default when it was left out. */
export const resolveDuration = (
  name: string,
  value: number | undefined,
  fallback: number,
) => {
  const duration = value ?? fallback;

  // The type allows NaN, fractions, infinities and negatives; a timer does not.
  if (!Number.isSafeInteger(duration) || duration <= 0) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: `${name} must be a positive whole number of milliseconds.`,
    });
  }

  return duration;
};
