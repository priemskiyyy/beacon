import type { ObservableValue } from "@priemskiyyy/beacon";

import { useSelectedValue } from "src/hooks/internal/useSelectedValue";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads any observable of Beacon and renders again when it changes; with a
 * selector, only when the selection changes. It is what the other hooks are
 * made of, for the observable they do not name, such as a route's `native`.
 *
 * @example
 * ```ts
 * const native = useObservable(beacon.route("ota").native);
 * ```
 */
export function useObservable<TValue>(value: ObservableValue<TValue>): TValue;

export function useObservable<TValue, TSelected>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useObservable<TValue>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => unknown = selectValue,
  { isEqual = Object.is }: SelectorOptions<unknown> = {},
): unknown {
  return useSelectedValue(value, selector, isEqual);
}
