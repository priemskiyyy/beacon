import type { RunningApplication, SelectorOptions } from "@priemskiyyy/beacon";
import type { ReadableValue } from "../types/ReadableValue.js";
import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
import { useProvidedBeacon } from "./internal/useProvidedBeacon.js";

/**
 * Reads what is running, of the provider's Beacon, through `current`; with a selector, what depends on it runs again only when the selection changes. A subject that is not read yet is pending, never an old version.
 *
 * @example
 * ```ts
 * const web = useRunning(({ web }) => web);
 * ```
 */
export function useRunning(): ReadableValue<RunningApplication>;

export function useRunning<TSelected>(
  selector: (value: RunningApplication) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ReadableValue<TSelected>;

export function useRunning(
  selector: (value: RunningApplication) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ReadableValue<unknown> {
  const beacon = useProvidedBeacon("useRunning");

  return useSelectedValue(() => beacon.current.running, selector, options);
}
