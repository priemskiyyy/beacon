import type { PlayBridge } from "src/types/PlayBridge";

/**
 * Options for `googlePlay()`. `bridge` is the native module that owns Play's
 * update manager. Asset-pack deletion and every other destructive option stay
 * off, and nothing a remote policy says can turn them on.
 *
 * @example
 * ```ts
 * googlePlay({ bridge: NativeModules.PlayUpdates });
 * ```
 */
export type PlayOptions = { bridge: PlayBridge };
