/**
 * The two areas of web storage the journal can live in. `session` is the tab
 * that reloads: the next boot after `location.reload()` is in the same tab, and
 * the area is gone when the tab closes. `local` is shared by every tab and
 * outlives the browser.
 *
 * @example
 * ```ts
 * const area: BrowserStorageArea = "session";
 * ```
 */
export type BrowserStorageArea = "session" | "local";
