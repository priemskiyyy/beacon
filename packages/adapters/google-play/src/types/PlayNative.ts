import type { PlayBridge } from "src/types/PlayBridge";

/**
 * What the route exposes as `route.native`: the injected bridge. Calling it
 * directly bypasses Beacon's admission and reservations, and its effects are
 * only seen again when the route reconciles.
 *
 * @example
 * ```ts
 * const bridge = beacon.route("binary").native.get()?.bridge;
 * ```
 */
export type PlayNative = { bridge: PlayBridge };
