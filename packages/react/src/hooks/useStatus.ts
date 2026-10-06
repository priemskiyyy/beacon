import type { BeaconStatus } from "@priemskiyyy/beacon";

import { useBeacon } from "src/hooks/useBeacon";
import { useObservable } from "src/hooks/useObservable";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads where the observation session stands, of the provider's Beacon: idle, running, stopped or disposed. With a selector, it renders again only when the selection changes.
 *
 * @example
 * ```ts
 * const active = useStatus(({ state }) => state === "running");
 * ```
 */
export function useStatus(): BeaconStatus;

export function useStatus<TSelected>(
  selector: (value: BeaconStatus) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useStatus(
  selector: (value: BeaconStatus) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): unknown {
  return useObservable(useBeacon().status, selector, options);
}
