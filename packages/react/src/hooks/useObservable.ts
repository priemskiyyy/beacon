import type { ObservableValue } from "@priemskiyyy/beacon";
import { useMemo, useSyncExternalStore } from "react";

import type { SelectorOptions } from "src/types/SelectorOptions";
import { createSelectionCache } from "src/utils/createSelectionCache";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads any observable of Beacon and renders again when it changes; with a
 * selector, only when the selection changes. It is what the other hooks are
 * made of, for the observable they do not name, such as a route's `native`.
 * It subscribes only while mounted. The server and the hydrating render read
 * the observable as it was before any session, which is what a server renders,
 * so a session that started in between cannot make the markup disagree.
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
  const select = useMemo(() => createSelectionCache<TValue, unknown>(), []);

  return useSyncExternalStore(
    value.subscribe,
    () => select(value.get(), selector, isEqual),
    () => select(value.getInitial(), selector, isEqual),
  );
}
