import type { ObservableValue } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { SelectorOptions } from "../types/SelectorOptions.js";
import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";

/**
 * Reads any observable of Beacon through `current` and follows it; with a
 * selector, what depends on it runs again only when the selection changes. It
 * is what the other utilities are made of, for the observable they do not
 * name, such as a route's `native`. The observable itself is not reactive.
 *
 * @example
 * ```ts
 * const native = useObservable(beacon.route("ota").native);
 * ```
 */
export function useObservable<TValue>(
  value: ObservableValue<TValue>,
): ReadableValue<TValue>;

export function useObservable<TValue, TSelected>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ReadableValue<TSelected>;

export function useObservable<TValue>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ReadableValue<unknown> {
  return useSelectedValue(() => value, selector, options);
}
