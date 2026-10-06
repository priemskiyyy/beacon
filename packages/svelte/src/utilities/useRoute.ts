import type { ReadableValue } from "../types/ReadableValue.js";
import type {
  RegisteredRouteName,
  RegisteredRouteState,
} from "../types/Register.js";
import type { SelectorOptions } from "../types/SelectorOptions.js";
import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
import { useBeacon } from "./useBeacon.js";

/**
 * Reads the state of a route of the provider's Beacon, by name, through
 * `current`; with a selector, what depends on it runs again only when the
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
): ReadableValue<RegisteredRouteState<TName>>;

export function useRoute<TName extends RegisteredRouteName, TSelected>(
  name: TName,
  selector: (snapshot: RegisteredRouteState<TName>) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ReadableValue<TSelected>;

export function useRoute<TName extends RegisteredRouteName>(
  name: TName,
  selector: (snapshot: RegisteredRouteState<TName>) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ReadableValue<unknown> {
  const beacon = useBeacon();

  return useSelectedValue(
    () => beacon.current.route(name).state,
    selector,
    options,
  );
}
