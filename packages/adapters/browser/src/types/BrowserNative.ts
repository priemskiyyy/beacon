import type { BrowserWindowLike } from "src/types/BrowserWindowLike";

/**
 * What the route exposes as `route.native`: the window whose document a
 * reload replaces, or `null` when there is none, as in a server render.
 * Reloading it directly bypasses Beacon's admission.
 *
 * @example
 * ```ts
 * const { window } = beacon.route("web").native.get() ?? { window: null };
 * ```
 */
export type BrowserNative = { window: BrowserWindowLike | null };
