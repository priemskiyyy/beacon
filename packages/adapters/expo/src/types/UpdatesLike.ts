import type { CheckResultLike } from "src/types/CheckResultLike";
import type { FetchResultLike } from "src/types/FetchResultLike";

/**
 * The part of the `expo-updates` module the adapter uses. Pass the module
 * itself: `import * as Updates from "expo-updates"`. The adapter never
 * imports it, so a test passes a fake, and a server render loads nothing.
 *
 * @example
 * ```ts
 * import * as Updates from "expo-updates";
 *
 * const ota = expoUpdates({ updates: Updates });
 * ```
 */
export type UpdatesLike = {
  isEnabled: boolean;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  isEmbeddedLaunch: boolean;
  isEmergencyLaunch: boolean;
  checkForUpdateAsync(): Promise<CheckResultLike>;
  fetchUpdateAsync(): Promise<FetchResultLike>;
  reloadAsync(): Promise<void>;
};
