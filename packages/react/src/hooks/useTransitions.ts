import type { SelectorOptions, TransitionState } from "@priemskiyyy/beacon";

import { useBeacon } from "src/hooks/useBeacon";
import { useObservable } from "src/hooks/useObservable";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads what the transition journal knows, of the provider's Beacon, and renders again when it changes; with a selector, only when the selection changes. Without a journal it says it is off, and nothing is correlated across boots.
 *
 * @example
 * ```ts
 * const exhausted = useTransitions(({ latest }) => latest?.exhausted === true);
 * ```
 */
export function useTransitions(): TransitionState;

export function useTransitions<TSelected>(
  selector: (value: TransitionState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useTransitions(
  selector: (value: TransitionState) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): unknown {
  return useObservable(useBeacon().transitions, selector, options);
}
