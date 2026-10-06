import type { BeaconStatus } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { SelectorOptions } from "../types/SelectorOptions.js";
/**
 * Reads where the observation session stands, of the provider's Beacon, through `current`: idle, running, stopped or disposed. With a selector, what depends on it runs again only when the selection changes.
 *
 * @example
 * ```ts
 * const active = useStatus(({ state }) => state === "running");
 * ```
 */
export declare function useStatus(): ReadableValue<BeaconStatus>;
export declare function useStatus<TSelected>(selector: (value: BeaconStatus) => TSelected, options?: SelectorOptions<NoInfer<TSelected>>): ReadableValue<TSelected>;
