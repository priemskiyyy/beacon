import type { SelectorOptions, SupportState } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
import { useProvidedBeacon } from "./internal/useProvidedBeacon.js";

/**
 * Reads whether the running application is acceptable under the application's policy, of the provider's Beacon, through `current`; with a selector, what depends on it runs again only when the selection changes. Support is unknown until a policy is accepted, and a failing check never changes it.
 *
 * @example
 * ```ts
 * const unsupported = useSupport(({ status }) => status === "unsupported");
 * ```
 */
export function useSupport(): ReadableValue<SupportState>;

export function useSupport<TSelected>(
  selector: (value: SupportState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ReadableValue<TSelected>;

export function useSupport(
  selector: (value: SupportState) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ReadableValue<unknown> {
  const beacon = useProvidedBeacon("useSupport");

  return useSelectedValue(() => beacon.current.support, selector, options);
}
