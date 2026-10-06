import type { PlayFlowResult } from "src/types/PlayFlowResult";
import type { PlayInstallEvent } from "src/types/PlayInstallEvent";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";

/**
 * The contract a native module keeps for this adapter. The `AppUpdateInfo`, the
 * Activity and the result launcher stay native: every start reacquires fresh
 * information itself, because Play allows one use of it, and rejects when there
 * is no Activity to launch from. `addInstallListener` answers how to remove
 * the listener.
 *
 * @example
 * ```ts
 * const bridge: PlayBridge = NativeModules.PlayUpdates;
 * ```
 */
export type PlayBridge = {
  getUpdateInfo(): Promise<PlayUpdateInfo>;
  startFlexible(): Promise<PlayFlowResult>;
  startImmediate(): Promise<PlayFlowResult>;
  completeUpdate(): Promise<void>;
  addInstallListener(listener: (event: PlayInstallEvent) => void): () => void;
};
