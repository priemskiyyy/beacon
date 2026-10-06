import type { CodePushLike } from "src/types/CodePushLike";

/**
 * What the route exposes as `route.native`: the injected CodePush module.
 * Calling it directly bypasses Beacon's admission and reservations.
 *
 * @example
 * ```ts
 * const codePush = beacon.route("update").native.get()?.codePush;
 * ```
 */
export type CodePushNative = { codePush: CodePushLike };
