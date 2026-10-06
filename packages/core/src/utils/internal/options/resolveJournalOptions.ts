import type { ResolvedJournalOptions } from "src/types/internal/ResolvedJournalOptions";
import type { JournalOptions } from "src/types/JournalOptions";
import { BeaconError } from "src/utils/BeaconError";
import {
  DEFAULT_JOURNAL_BUDGET,
  DEFAULT_JOURNAL_RETENTION,
} from "src/utils/constants/journal";
import { keyValueJournalStorage } from "src/utils/keyValueJournalStorage";
import { resolveDuration } from "src/utils/internal/options/resolveDuration";

// A key-value store is told by `getItem`, which Web Storage has on its prototype whatever keys an application stored; it is wrapped and read back after every write. Anything else is the journal's own storage.
const toJournalStorage = (storage: JournalOptions["storage"]) => {
  if ("getItem" in storage) {
    return keyValueJournalStorage(storage);
  }

  return storage;
};

/** The journal options, or `undefined` for a Beacon without one, with the mode and the storage settled; a budget or a retention that cannot work is refused at once. */
export const resolveJournalOptions = (
  options: JournalOptions | undefined,
  timeout: number,
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
    mode: options.mode ?? "best-effort",
    storage: toJournalStorage(options.storage),
    budget,
    retention: resolveDuration(
      "journal.retention",
      options.retention,
      DEFAULT_JOURNAL_RETENTION,
    ),
    timeout,
  };
};
