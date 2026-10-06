import type { KeyValueStoreLike } from "@priemskiyyy/beacon";

/**
 * The part of a browser window the storage uses: its two areas of web storage.
 * The real `window` satisfies it, so a test or a frame can pass its own
 * without a DOM. Each area is reached when the journal asks, and never held,
 * since reading the property throws in a sandboxed frame.
 *
 * @example
 * ```ts
 * const target: BrowserStorageWindowLike = window;
 * ```
 */
export type BrowserStorageWindowLike = {
  sessionStorage: KeyValueStoreLike;
  localStorage: KeyValueStoreLike;
};
