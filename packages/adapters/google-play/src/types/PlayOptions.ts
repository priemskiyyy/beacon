import type { PlayBridge } from "src/types/PlayBridge";

/**
 * Options for `googlePlay()`. `bridge` is the object over the native module
 * that owns Play's update manager. Asset-pack deletion and every other
 * destructive option stay off, and nothing a remote policy says can turn them
 * on.
 *
 * @example
 * ```ts
 * googlePlay({ bridge: playBridge });
 * ```
 */
export type PlayOptions = { bridge: PlayBridge };
