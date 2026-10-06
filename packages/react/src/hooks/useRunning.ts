import type { RunningApplication } from "@priemskiyyy/beacon";

import { useSelectedValue } from "src/hooks/internal/useSelectedValue";
import { useResolvedBeacon } from "src/hooks/internal/useResolvedBeacon";
import type { ReactBeacon } from "src/types/ReactBeacon";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads what is running, of the given Beacon or the provider's, and renders
 * again when it changes; with a selector, only when the selection changes. A
 * subject that is not read yet is pending, never an old version.
 *
 * @example
 * ```ts
 * const running = useRunning();
 * const web = useRunning(beacon, ({ web }) => web);
 * ```
 */
export function useRunning(beacon?: ReactBeacon): RunningApplication;

export function useRunning<TSelected>(
  beacon: ReactBeacon,
  selector: (running: RunningApplication) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useRunning(
  beacon?: ReactBeacon,
  selector: (running: RunningApplication) => unknown = selectValue,
  { isEqual = Object.is }: SelectorOptions<unknown> = {},
): unknown {
  const { running } = useResolvedBeacon(beacon, "useRunning");

  return useSelectedValue(running, selector, isEqual);
}
