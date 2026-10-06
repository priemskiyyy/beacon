/**
 * The part of a browser window the `foreground` trigger uses: its document,
 * which says whether the page is visible and tells when that changes, and the
 * `pageshow` event, which tells a page restored from the back-forward cache.
 * The real `window` satisfies it, so a test or a frame can pass its own
 * without a DOM, and a server render, which has none, loads nothing.
 *
 * @example
 * ```ts
 * const returns = foreground({ target: window });
 * ```
 */
export type ForegroundWindowLike = {
  document: {
    /** `visible` while the page can be seen, and `hidden` when its tab is behind another or the window is minimized. */
    visibilityState: string;
    addEventListener(type: "visibilitychange", listener: () => void): void;
    removeEventListener(type: "visibilitychange", listener: () => void): void;
  };
  addEventListener(
    type: "pageshow",
    listener: (event: { persisted: boolean }) => void,
  ): void;
  removeEventListener(
    type: "pageshow",
    listener: (event: { persisted: boolean }) => void,
  ): void;
};
