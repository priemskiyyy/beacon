import type { RunningApplication } from "@priemskiyyy/beacon";
import type { Accessor } from "solid-js";

import { useBeacon } from "src/primitives/useBeacon";
import { useSelectedValue } from "src/primitives/internal/useSelectedValue";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads what is running, of the provider's Beacon, as an accessor that changes when it does; with a selector, only when the selection changes. A subject that is not read yet is pending, never an old version.
 *
 * @example
 * ```ts
 * const web = useRunning(({ web }) => web);
 * ```
 */
export function useRunning(): Accessor<RunningApplication>;

export function useRunning<TSelected>(
  selector: (value: RunningApplication) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): Accessor<TSelected>;

export function useRunning(
  selector: (value: RunningApplication) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): Accessor<unknown> {
  const beacon = useBeacon();

  return useSelectedValue(() => beacon().running, selector, options);
}
