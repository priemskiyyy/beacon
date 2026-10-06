import type { BrowserWindowLike } from "src/types/BrowserWindowLike";

/**
 * Options for `browserReload()`. `target` is the window whose document is
 * reloaded, the global `window` by default. Without either, such as in a
 * server render, the mechanism opens inert and its command is unsupported.
 *
 * @example
 * ```ts
 * browserReload({ target: window.parent });
 * ```
 */
export type BrowserReloadOptions = {
  target?: BrowserWindowLike;
};
