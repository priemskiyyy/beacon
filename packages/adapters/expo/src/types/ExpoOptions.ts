import type { UpdatesLike } from "src/types/UpdatesLike";

/**
 * Options for `expoUpdates()`. `updates` is the `expo-updates` module the
 * application already configured. The adapter changes none of its
 * configuration: no update URL, header, channel or anti-bricking setting.
 *
 * @example
 * ```ts
 * expoUpdates({ updates: Updates });
 * ```
 */
export type ExpoOptions = {
  updates: UpdatesLike;
};
