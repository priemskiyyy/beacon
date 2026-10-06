import type { ObservableValue, SelectorOptions } from "@priemskiyyy/beacon";
import type { ComputedRef } from "vue";

import { useSelectedValue } from "src/composables/internal/useSelectedValue";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads any observable of Beacon as a read-only computed ref that changes when
 * the observable does; with a selector, only when the selection changes. It is
 * what the other composables are made of, for the observable they do not name,
 * such as a route's `native`. It reads the observable as it was before any
 * session until the component is mounted, so the server and the hydrating
 * client render the same markup.
 *
 * @example
 * ```ts
 * const native = useObservable(beacon.route("ota").native);
 * ```
 */
export function useObservable<TValue>(
  value: ObservableValue<TValue>,
): ComputedRef<TValue>;

export function useObservable<TValue, TSelected>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ComputedRef<TSelected>;

export function useObservable<TValue>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ComputedRef<unknown> {
  return useSelectedValue(() => value, selector, options);
}
