import type { SelectorOptions, SupportState } from "@priemskiyyy/beacon";
import type { ComputedRef } from "vue";

import { useProvidedBeacon } from "src/composables/internal/useProvidedBeacon";
import { useSelectedValue } from "src/composables/internal/useSelectedValue";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads whether the running application is acceptable under the application's
 * policy, of the provider's Beacon, as a read-only computed ref that changes
 * when it does; with a selector, only when the selection changes. Support is
 * unknown until a policy is accepted, and a failing check never changes it.
 *
 * @example
 * ```ts
 * const unsupported = useSupport(({ status }) => status === "unsupported");
 * ```
 */
export function useSupport(): ComputedRef<SupportState>;

export function useSupport<TSelected>(
  selector: (value: SupportState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): ComputedRef<TSelected>;

export function useSupport(
  selector: (value: SupportState) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): ComputedRef<unknown> {
  const beacon = useProvidedBeacon("useSupport");

  return useSelectedValue(() => beacon.value.support, selector, options);
}
