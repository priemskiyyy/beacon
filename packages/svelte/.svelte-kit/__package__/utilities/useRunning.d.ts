import type { RunningApplication } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { SelectorOptions } from "../types/SelectorOptions.js";
/**
 * Reads what is running, of the provider's Beacon, through `current`; with a selector, what depends on it runs again only when the selection changes. A subject that is not read yet is pending, never an old version.
 *
 * @example
 * ```ts
 * const web = useRunning(({ web }) => web);
 * ```
 */
export declare function useRunning(): ReadableValue<RunningApplication>;
export declare function useRunning<TSelected>(selector: (value: RunningApplication) => TSelected, options?: SelectorOptions<NoInfer<TSelected>>): ReadableValue<TSelected>;
