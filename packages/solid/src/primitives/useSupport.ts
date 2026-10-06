import type { SelectorOptions, SupportState } from "@priemskiyyy/beacon";
import type { Accessor } from "solid-js";

import { useBeacon } from "src/primitives/useBeacon";
import { useSelectedValue } from "src/primitives/internal/useSelectedValue";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads whether the running application is acceptable under the application's policy, of the provider's Beacon, as an accessor that changes when it does; with a selector, only when the selection changes. Support is unknown until a policy is accepted, and a failing check never changes it.
 *
 * @example
 * ```ts
 * const unsupported = useSupport(({ status }) => status === "unsupported");
 * ```
 */
export function useSupport(): Accessor<SupportState>;

export function useSupport<TSelected>(
  selector: (value: SupportState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): Accessor<TSelected>;

export function useSupport(
  selector: (value: SupportState) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): Accessor<unknown> {
  const beacon = useBeacon();

  return useSelectedValue(() => beacon().support, selector, options);
}
