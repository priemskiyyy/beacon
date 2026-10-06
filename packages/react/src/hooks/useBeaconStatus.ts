import type { BeaconStatus, SelectorOptions } from "@priemskiyyy/beacon";

import { useProvidedBeacon } from "src/hooks/internal/useProvidedBeacon";
import { useObservable } from "src/hooks/useObservable";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads where the observation session stands, of the provider's Beacon: idle, running, stopped or disposed. With a selector, it renders again only when the selection changes.
 *
 * @example
 * ```ts
 * const active = useBeaconStatus(({ state }) => state === "running");
 * ```
 */
export function useBeaconStatus(): BeaconStatus;

export function useBeaconStatus<TSelected>(
  selector: (value: BeaconStatus) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useBeaconStatus(
  selector: (value: BeaconStatus) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): unknown {
  return useObservable(
    useProvidedBeacon("useBeaconStatus").status,
    selector,
    options,
  );
}
