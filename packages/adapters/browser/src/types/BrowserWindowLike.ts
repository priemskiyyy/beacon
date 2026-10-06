/**
 * The part of a browser window the mechanism uses: the location it can
 * reload. The real `window` satisfies it, so a test or a frame can pass its
 * own without a DOM.
 *
 * @example
 * ```ts
 * const target: BrowserWindowLike = window;
 * ```
 */
export type BrowserWindowLike = {
  location: { reload(): void };
};
