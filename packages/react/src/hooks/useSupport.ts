import type { SelectorOptions, SupportState } from "@priemskiyyy/beacon";

import { useBeacon } from "src/hooks/useBeacon";
import { useObservable } from "src/hooks/useObservable";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads whether the running application is acceptable under the application's policy, of the provider's Beacon, and renders again when it changes; with a selector, only when the selection changes. Support is unknown until a policy is accepted, and a failing check never changes it.
 *
 * @example
 * ```ts
 * const unsupported = useSupport(({ status }) => status === "unsupported");
 * ```
 */
export function useSupport(): SupportState;

export function useSupport<TSelected>(
  selector: (value: SupportState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useSupport(
  selector: (value: SupportState) => unknown = selectValue,
  options: SelectorOptions<unknown> = {},
): unknown {
  return useObservable(useBeacon().support, selector, options);
}
