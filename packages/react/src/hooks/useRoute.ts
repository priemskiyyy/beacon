import type { SelectorOptions } from "@priemskiyyy/beacon";
import { useProvidedBeacon } from "src/hooks/internal/useProvidedBeacon";
import { useObservable } from "src/hooks/useObservable";
import type {
  RegisteredRouteName,
  RegisteredRouteState,
} from "src/types/Register";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads the state of a route of the provider's Beacon, by name, and renders
 * again when it changes; with a selector, only when the selection changes. It
 * never checks the route or starts a session. For a route handle you hold,
 * read `handle.state` with `useObservable`.
 *
 * @example
 * ```ts
 * const snapshot = useRoute("web");
 * const checking = useRoute("web", ({ check }) => check.state === "checking");
 * ```
 */
export function useRoute<TName extends RegisteredRouteName>(
  name: TName,
): RegisteredRouteState<TName>;

export function useRoute<TName extends RegisteredRouteName, TSelected>(
  name: TName,
  selector: (snapshot: RegisteredRouteState<TName>) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useRoute<TName extends RegisteredRouteName>(
  name: TName,
  selector: (snapshot: RegisteredRouteState<TName>) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): unknown {
  return useObservable(
    useProvidedBeacon("useRoute").route(name).state,
    selector,
    options,
  );
}
