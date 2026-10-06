import type { BeaconStatus, SelectorOptions } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
import { useProvidedBeacon } from "./internal/useProvidedBeacon.js";

/**
 * Reads where the observation session stands, of the provider's Beacon, through `current`: idle, running, stopped or disposed. With a selector, what depends on it runs again only when the selection changes.
 *
 * @example
 * ```ts
 * const active = useBeaconStatus(({ state }) => state === "running");
 * ```
 */
export function useBeaconStatus(): ReadableValue<BeaconStatus>;

export function useBeaconStatus<TSelected>(
  selector: (value: BeaconStatus) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ReadableValue<TSelected>;

export function useBeaconStatus(
  selector: (value: BeaconStatus) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ReadableValue<unknown> {
  const beacon = useProvidedBeacon("useBeaconStatus");

  return useSelectedValue(() => beacon.current.status, selector, options);
}
