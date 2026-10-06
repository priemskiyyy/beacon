import type { TransitionState } from "@priemskiyyy/beacon";

import { useResolvedBeacon } from "src/hooks/internal/useResolvedBeacon";
import { useSelectedValue } from "src/hooks/internal/useSelectedValue";
import type { ReactBeacon } from "src/types/ReactBeacon";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads what the transition journal knows, of the given Beacon or the
 * provider's, and renders again when it changes; with a selector, only when
 * the selection changes. Without a journal it says it is off, and nothing is
 * correlated across boots.
 *
 * @example
 * ```ts
 * const transitions = useTransitions();
 * const exhausted = useTransitions(beacon, ({ latest }) => latest?.exhausted === true);
 * ```
 */
export function useTransitions(beacon?: ReactBeacon): TransitionState;

export function useTransitions<TSelected>(
  beacon: ReactBeacon,
  selector: (transitions: TransitionState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useTransitions(
  beacon?: ReactBeacon,
  selector: (transitions: TransitionState) => unknown = selectValue,
  { isEqual = Object.is }: SelectorOptions<unknown> = {},
): unknown {
  const { transitions } = useResolvedBeacon(beacon, "useTransitions");

  return useSelectedValue(transitions, selector, isEqual);
}
