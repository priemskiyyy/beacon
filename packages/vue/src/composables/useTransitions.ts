import type { TransitionState } from "@priemskiyyy/beacon";
import type { ComputedRef } from "vue";

import { useBeacon } from "src/composables/useBeacon";
import { useSelectedValue } from "src/composables/internal/useSelectedValue";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads what the transition journal knows, of the provider's Beacon, as a
 * read-only computed ref that changes when it does; with a selector, only when
 * the selection changes. Without a journal it says it is off, and nothing is
 * correlated across boots.
 *
 * @example
 * ```ts
 * const exhausted = useTransitions(({ latest }) => latest?.exhausted === true);
 * ```
 */
export function useTransitions(): ComputedRef<TransitionState>;

export function useTransitions<TSelected>(
  selector: (value: TransitionState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ComputedRef<TSelected>;

export function useTransitions(
  selector: (value: TransitionState) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ComputedRef<unknown> {
  const beacon = useBeacon();

  return useSelectedValue(() => beacon.value.transitions, selector, options);
}
