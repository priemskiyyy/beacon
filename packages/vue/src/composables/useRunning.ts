import type { RunningApplication, SelectorOptions } from "@priemskiyyy/beacon";
import type { ComputedRef } from "vue";

import { useProvidedBeacon } from "src/composables/internal/useProvidedBeacon";
import { useSelectedValue } from "src/composables/internal/useSelectedValue";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads what is running, of the provider's Beacon, as a read-only computed ref
 * that changes when it does; with a selector, only when the selection changes.
 * A subject that is not read yet is pending, never an old version.
 *
 * @example
 * ```ts
 * const web = useRunning(({ web }) => web);
 * ```
 */
export function useRunning(): ComputedRef<RunningApplication>;

export function useRunning<TSelected>(
  selector: (value: RunningApplication) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ComputedRef<TSelected>;

export function useRunning(
  selector: (value: RunningApplication) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ComputedRef<unknown> {
  const beacon = useProvidedBeacon("useRunning");

  return useSelectedValue(() => beacon.value.running, selector, options);
}
