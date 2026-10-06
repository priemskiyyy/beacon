import type { BeaconStatus, SelectorOptions } from "@priemskiyyy/beacon";
import type { ComputedRef } from "vue";

import { useProvidedBeacon } from "src/composables/internal/useProvidedBeacon";
import { useSelectedValue } from "src/composables/internal/useSelectedValue";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads where the observation session stands, of the provider's Beacon, as a
 * read-only computed ref: idle, running, stopped or disposed. With a selector,
 * it changes only when the selection changes.
 *
 * @example
 * ```ts
 * const active = useBeaconStatus(({ state }) => state === "running");
 * ```
 */
export function useBeaconStatus(): ComputedRef<BeaconStatus>;

export function useBeaconStatus<TSelected>(
  selector: (value: BeaconStatus) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ComputedRef<TSelected>;

export function useBeaconStatus(
  selector: (value: BeaconStatus) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ComputedRef<unknown> {
  const beacon = useProvidedBeacon("useBeaconStatus");

  return useSelectedValue(() => beacon.value.status, selector, options);
}
