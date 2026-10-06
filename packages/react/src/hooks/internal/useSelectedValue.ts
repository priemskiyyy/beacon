import type { ObservableValue } from "@priemskiyyy/beacon";
import { useMemo, useSyncExternalStore } from "react";

import { createSelection } from "src/utils/createSelection";

/**
 * Reads a selection of an observable through React's external store. It
 * subscribes only while mounted. The server and the hydrating render read the
 * observable as it stands, which is before any session started.
 *
 * @example
 * ```ts
 * const state = useSelectedValue(route.state, selectValue, Object.is);
 * ```
 */
export const useSelectedValue = <TValue, TSelected>(
  value: ObservableValue<TValue>,
  selector: (value: TValue) => TSelected,
  isEqual: (previous: TSelected, next: TSelected) => boolean,
): TSelected => {
  const getSnapshot = useMemo(
    () => createSelection(value.get, selector, isEqual),
    [value, selector, isEqual],
  );

  return useSyncExternalStore(value.subscribe, getSnapshot, getSnapshot);
};
