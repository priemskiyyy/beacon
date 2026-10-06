import { keyValueJournalStorage } from "@priemskiyyy/beacon";
import type { JournalStorage } from "@priemskiyyy/beacon";

import type { BrowserStorageOptions } from "src/types/BrowserStorageOptions";
import { openStorage } from "src/utils/openStorage";

/**
 * The journal's storage in the browser's web storage. The default is
 * `sessionStorage`: a reload keeps the tab, so the next boot reads what this
 * one wrote, and no other tab can overwrite it. `area: "local"` uses
 * `localStorage`, shared by every tab, where a fresh tab can judge another
 * tab's intent and the last write wins. Nothing is touched until the journal
 * reads, so creating it in a server render is harmless, and the storage is
 * reached at each call: a render without a window, a frame that blocks site
 * data and a full storage each reject that call, so a `required` journal stops
 * the reload and a `best-effort` one says `degraded`. Built on
 * `keyValueJournalStorage`, it reads the record back after every write unless
 * `verify` is `false`.
 *
 * @example
 * ```ts
 * const journal = { mode: "required", storage: browserStorage() } satisfies JournalOptions;
 * ```
 */
export const browserStorage = ({
  area = "session",
  target,
  verify = true,
}: BrowserStorageOptions = {}): JournalStorage =>
  keyValueJournalStorage(
    {
      getItem: (key) => openStorage(area, target).getItem(key),
      setItem: (key, value) => openStorage(area, target).setItem(key, value),
      removeItem: (key) => openStorage(area, target).removeItem(key),
    },
    { verify },
  );
