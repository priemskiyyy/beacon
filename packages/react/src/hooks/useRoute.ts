import type { ObservableValue } from "@priemskiyyy/beacon";

import { useSelectedValue } from "src/hooks/internal/useSelectedValue";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads a route's state and renders again when it changes; with a selector,
 * only when the selection changes. It never checks the route or starts a
 * session, and the types of the route's offer and prepared target come from
 * its handle.
 *
 * @example
 * ```ts
 * const web = beacon.route("web");
 * const snapshot = useRoute(web);
 * const checking = useRoute(web, ({ check }) => check.state === "checking");
 * ```
 */
export function useRoute<TSnapshot>(route: {
  state: ObservableValue<TSnapshot>;
}): TSnapshot;

export function useRoute<TSnapshot, TSelected>(
  route: { state: ObservableValue<TSnapshot> },
  selector: (snapshot: TSnapshot) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useRoute<TSnapshot>(
  route: { state: ObservableValue<TSnapshot> },
  selector: (snapshot: TSnapshot) => unknown = selectValue,
  { isEqual = Object.is }: SelectorOptions<unknown> = {},
): unknown {
  return useSelectedValue(route.state, selector, isEqual);
}
