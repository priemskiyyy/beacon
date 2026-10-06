import type { UpdatesLike } from "src/types/UpdatesLike";

/**
 * What the route exposes as `route.native`: the injected `expo-updates`
 * module. Calling it directly bypasses Beacon's admission and reservations.
 *
 * @example
 * ```ts
 * const updates = beacon.route("ota").native.get()?.updates;
 * ```
 */
export type ExpoNative = { updates: UpdatesLike };
