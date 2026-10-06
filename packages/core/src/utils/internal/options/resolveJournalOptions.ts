import type { ResolvedJournalOptions } from "src/types/internal/ResolvedJournalOptions";
import type { JournalOptions } from "src/types/JournalOptions";
import { BeaconError } from "src/utils/BeaconError";
import {
  DEFAULT_JOURNAL_BUDGET,
  DEFAULT_JOURNAL_RETENTION,
} from "src/utils/constants/journal";
import { resolveDuration } from "src/utils/internal/options/resolveDuration";

/** The journal options, or `undefined` for a Beacon without one; a budget or a retention that cannot work is refused at once. */
export const resolveJournalOptions = (
  options: JournalOptions | undefined,
): ResolvedJournalOptions | undefined => {
  if (options === undefined) {
    return undefined;
  }

  const budget = options.budget ?? DEFAULT_JOURNAL_BUDGET;

  if (!Number.isSafeInteger(budget) || budget <= 0) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message: "journal.budget must be a positive whole number of boots.",
    });
  }

  return {
    mode: options.mode,
    storage: options.storage,
    budget,
    retention: resolveDuration(
      "journal.retention",
      options.retention,
      DEFAULT_JOURNAL_RETENTION,
    ),
  };
};
