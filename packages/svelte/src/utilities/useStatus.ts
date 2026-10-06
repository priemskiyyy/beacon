import type { BeaconStatus } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { SelectorOptions } from "../types/SelectorOptions.js";
import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
import { useBeacon } from "./useBeacon.js";

/**
 * Reads where the observation session stands, of the provider's Beacon, through `current`: idle, running, stopped or disposed. With a selector, what depends on it runs again only when the selection changes.
 *
 * @example
 * ```ts
 * const active = useStatus(({ state }) => state === "running");
 * ```
 */
export function useStatus(): ReadableValue<BeaconStatus>;

export function useStatus<TSelected>(
  selector: (value: BeaconStatus) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ReadableValue<TSelected>;

export function useStatus(
  selector: (value: BeaconStatus) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ReadableValue<unknown> {
  const beacon = useBeacon();

  return useSelectedValue(() => beacon.current.status, selector, options);
}
