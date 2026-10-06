import { BeaconError } from "src/utils/BeaconError";

/** Runs an application's version strategy so that its failure becomes a Beacon error, never a coerced result. */
export const runStrategy = <TResult>(
  strategy: string,
  action: () => TResult,
): TResult => {
  try {
    return action();
  } catch (cause) {
    if (cause instanceof BeaconError) {
      throw cause;
    }

    throw new BeaconError({
      code: "SELECTION_FAILED",
      message: `The ${strategy} version strategy failed.`,
      cause,
    });
  }
};
