import type { TransitionState } from "@priemskiyyy/beacon";
import type { Accessor } from "solid-js";

import { useBeacon } from "src/primitives/useBeacon";
import { useSelectedValue } from "src/primitives/internal/useSelectedValue";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads what the transition journal knows, of the provider's Beacon, as an accessor that changes when it does; with a selector, only when the selection changes. Without a journal it says it is off, and nothing is correlated across boots.
 *
 * @example
 * ```ts
 * const exhausted = useTransitions(({ latest }) => latest?.exhausted === true);
 * ```
 */
export function useTransitions(): Accessor<TransitionState>;

export function useTransitions<TSelected>(
  selector: (value: TransitionState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): Accessor<TSelected>;

export function useTransitions(
  selector: (value: TransitionState) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): Accessor<unknown> {
  const beacon = useBeacon();

  return useSelectedValue(() => beacon().transitions, selector, options);
}
