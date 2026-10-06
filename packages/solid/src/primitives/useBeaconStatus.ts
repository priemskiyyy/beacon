import type { BeaconStatus, SelectorOptions } from "@priemskiyyy/beacon";
import type { Accessor } from "solid-js";

import { useProvidedBeacon } from "src/primitives/internal/useProvidedBeacon";
import { useSelectedValue } from "src/primitives/internal/useSelectedValue";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads where the observation session stands, of the provider's Beacon, as an accessor: idle, running, stopped or disposed. With a selector, it changes only when the selection changes.
 *
 * @example
 * ```ts
 * const active = useBeaconStatus(({ state }) => state === "running");
 * ```
 */
export function useBeaconStatus(): Accessor<BeaconStatus>;

export function useBeaconStatus<TSelected>(
  selector: (value: BeaconStatus) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): Accessor<TSelected>;

export function useBeaconStatus(
  selector: (value: BeaconStatus) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): Accessor<unknown> {
  const beacon = useProvidedBeacon("useBeaconStatus");

  return useSelectedValue(() => beacon().status, selector, options);
}
