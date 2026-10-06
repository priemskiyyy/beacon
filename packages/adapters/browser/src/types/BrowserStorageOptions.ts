import type { BrowserStorageArea } from "src/types/BrowserStorageArea";
import type { BrowserStorageWindowLike } from "src/types/BrowserStorageWindowLike";

/**
 * Options for `browserStorage()`. `area` is `session` by default, the tab
 * whose document the reload replaces, so the boot that reads the intent back
 * is the one that wrote it and two tabs never share a record. `local` lets a
 * fresh tab judge another tab's intent, and the tabs then share one record
 * where the last write wins. `target` is the window whose storage is used, the
 * global `window` by default. `verify` reads the record back after a write, as
 * `keyValueJournalStorage` does, and is on by default.
 *
 * @example
 * ```ts
 * const options: BrowserStorageOptions = { area: "local" };
 * ```
 */
export type BrowserStorageOptions = {
  area?: BrowserStorageArea;
  target?: BrowserStorageWindowLike;
  verify?: boolean;
};
