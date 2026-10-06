import type { ObservableValue } from "@priemskiyyy/beacon";
import { useMemo, useSyncExternalStore } from "react";

import { createSelection } from "src/utils/createSelection";

/**
 * Reads a selection of an observable through React's external store. It
 * subscribes only while mounted. The server and the hydrating render read the
 * observable as it was before any session, which is what a server renders, so
 * a session that started in between cannot make the markup disagree.
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

  const getServerSnapshot = useMemo(
    () => createSelection(value.getInitial, selector, isEqual),
    [value, selector, isEqual],
  );

  return useSyncExternalStore(value.subscribe, getSnapshot, getServerSnapshot);
};
