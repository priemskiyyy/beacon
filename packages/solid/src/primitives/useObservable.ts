import type { ObservableValue } from "@priemskiyyy/beacon";
import type { Accessor } from "solid-js";

import { useSelectedValue } from "src/primitives/internal/useSelectedValue";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads any observable of Beacon as an accessor that changes when it does;
 * with a selector, only when the selection changes. It is what the other
 * primitives are made of, for the observable they do not name, such as a
 * route's `native`. It reads the observable as it was before any session until
 * mounted, and the observable is fixed, not reactive.
 *
 * @example
 * ```ts
 * const native = useObservable(beacon.route("ota").native);
 * ```
 */
export function useObservable<TValue>(
  value: ObservableValue<TValue>,
): Accessor<TValue>;

export function useObservable<TValue, TSelected>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): Accessor<TSelected>;

export function useObservable<TValue>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): Accessor<unknown> {
  return useSelectedValue(() => value, selector, options);
}
