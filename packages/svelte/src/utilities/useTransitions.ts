import type { SelectorOptions, TransitionState } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
import { useProvidedBeacon } from "./internal/useProvidedBeacon.js";

/**
 * Reads what the transition journal knows, of the provider's Beacon, through `current`; with a selector, what depends on it runs again only when the selection changes. Without a journal it says it is off, and nothing is correlated across boots.
 *
 * @example
 * ```ts
 * const updated = useTransitions(
 *   ({ latest }) =>
 *     latest?.judgedHere === true && latest.outcome === "target-running",
 * );
 * ```
 */
export function useTransitions(): ReadableValue<TransitionState>;

export function useTransitions<TSelected>(
  selector: (value: TransitionState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ReadableValue<TSelected>;

export function useTransitions(
  selector: (value: TransitionState) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ReadableValue<unknown> {
  const beacon = useProvidedBeacon("useTransitions");

  return useSelectedValue(() => beacon.current.transitions, selector, options);
}
