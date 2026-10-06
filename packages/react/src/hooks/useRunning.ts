import type { RunningApplication, SelectorOptions } from "@priemskiyyy/beacon";

import { useBeacon } from "src/hooks/useBeacon";
import { useObservable } from "src/hooks/useObservable";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads what is running, of the provider's Beacon, and renders again when it changes; with a selector, only when the selection changes. A subject that is not read yet is pending, never an old version.
 *
 * @example
 * ```ts
 * const web = useRunning(({ web }) => web);
 * ```
 */
export function useRunning(): RunningApplication;

export function useRunning<TSelected>(
  selector: (value: RunningApplication) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useRunning(
  selector: (value: RunningApplication) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): unknown {
  return useObservable(useBeacon().running, selector, options);
}
