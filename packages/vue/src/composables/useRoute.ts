import type { ComputedRef } from "vue";

import { useBeacon } from "src/composables/useBeacon";
import { useSelectedValue } from "src/composables/internal/useSelectedValue";
import type {
  RegisteredRouteName,
  RegisteredRouteState,
} from "src/types/Register";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads the state of a route of the provider's Beacon, by name, as a read-only
 * computed ref that changes when it does; with a selector, only when the
 * selection changes. It never checks the route or starts a session. For a
 * route handle you hold, read `handle.state` with `useObservable`.
 *
 * @example
 * ```ts
 * const snapshot = useRoute("web");
 * const checking = useRoute("web", ({ check }) => check.state === "checking");
 * ```
 */
export function useRoute<TName extends RegisteredRouteName>(
  name: TName,
): ComputedRef<RegisteredRouteState<TName>>;

export function useRoute<TName extends RegisteredRouteName, TSelected>(
  name: TName,
  selector: (snapshot: RegisteredRouteState<TName>) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ComputedRef<TSelected>;

export function useRoute<TName extends RegisteredRouteName>(
  name: TName,
  selector: (snapshot: RegisteredRouteState<TName>) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ComputedRef<unknown> {
  const beacon = useBeacon();

  return useSelectedValue(
    () => beacon.value.route(name).state,
    selector,
    options,
  );
}
