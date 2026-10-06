import type { LinkingLike } from "src/types/LinkingLike";

/**
 * What the store route exposes as `route.native`: the link opener the
 * application passed in, and the `distribution` of the scope the session runs
 * under, which decides whether the store is opened. Calling the opener
 * directly bypasses Beacon's admission and reservations.
 *
 * @example
 * ```ts
 * const native: PlayStoreNative = { linking: Linking, distribution: "google-play" };
 * ```
 */
export type PlayStoreNative = { linking: LinkingLike; distribution: string };
