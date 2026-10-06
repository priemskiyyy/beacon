import type { SelectorOptions } from "@priemskiyyy/beacon";
import type { Accessor } from "solid-js";

import { useProvidedBeacon } from "src/primitives/internal/useProvidedBeacon";
import { useSelectedValue } from "src/primitives/internal/useSelectedValue";
import type {
  RegisteredRouteName,
  RegisteredRouteState,
} from "src/types/Register";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads the state of a route of the provider's Beacon, by name, as an accessor
 * that changes when it does; with a selector, only when the selection changes.
 * It never checks the route or starts a session. The name is fixed, not
 * reactive. For a route handle you hold, read `handle.state` with
 * `useObservable`.
 *
 * @example
 * ```ts
 * const snapshot = useRoute("web");
 * const checking = useRoute("web", ({ check }) => check.state === "checking");
 * ```
 */
export function useRoute<TName extends RegisteredRouteName>(
  name: TName,
): Accessor<RegisteredRouteState<TName>>;

export function useRoute<TName extends RegisteredRouteName, TSelected>(
  name: TName,
  selector: (snapshot: RegisteredRouteState<TName>) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): Accessor<TSelected>;

export function useRoute<TName extends RegisteredRouteName>(
  name: TName,
  selector: (snapshot: RegisteredRouteState<TName>) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): Accessor<unknown> {
  const beacon = useProvidedBeacon("useRoute");

  return useSelectedValue(() => beacon().route(name).state, selector, options);
}
