import type { BeaconStatus } from "@priemskiyyy/beacon";
import type { ComputedRef } from "vue";

import { useBeacon } from "src/composables/useBeacon";
import { useSelectedValue } from "src/composables/internal/useSelectedValue";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads where the observation session stands, of the provider's Beacon, as a
 * read-only computed ref: idle, running, stopped or disposed. With a selector,
 * it changes only when the selection changes.
 *
 * @example
 * ```ts
 * const active = useStatus(({ state }) => state === "running");
 * ```
 */
export function useStatus(): ComputedRef<BeaconStatus>;

export function useStatus<TSelected>(
  selector: (value: BeaconStatus) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ComputedRef<TSelected>;

export function useStatus(
  selector: (value: BeaconStatus) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ComputedRef<unknown> {
  const beacon = useBeacon();

  return useSelectedValue(() => beacon.value.status, selector, options);
}
