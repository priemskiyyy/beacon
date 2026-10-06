import type { TransitionState } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { SelectorOptions } from "../types/SelectorOptions.js";
/**
 * Reads what the transition journal knows, of the provider's Beacon, through `current`; with a selector, what depends on it runs again only when the selection changes. Without a journal it says it is off, and nothing is correlated across boots.
 *
 * @example
 * ```ts
 * const exhausted = useTransitions(({ latest }) => latest?.exhausted === true);
 * ```
 */
export declare function useTransitions(): ReadableValue<TransitionState>;
export declare function useTransitions<TSelected>(selector: (value: TransitionState) => TSelected, options?: SelectorOptions<NoInfer<TSelected>>): ReadableValue<TSelected>;
