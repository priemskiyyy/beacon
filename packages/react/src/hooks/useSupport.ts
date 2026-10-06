import type { SupportState } from "@priemskiyyy/beacon";

import { useResolvedBeacon } from "src/hooks/internal/useResolvedBeacon";
import { useSelectedValue } from "src/hooks/internal/useSelectedValue";
import type { ReactBeacon } from "src/types/ReactBeacon";
import type { SelectorOptions } from "src/types/SelectorOptions";
import { selectValue } from "src/utils/selectValue";

/**
 * Reads whether the running application is acceptable under the application's
 * policy, of the given Beacon or the provider's, and renders again when it
 * changes; with a selector, only when the selection changes. Support is
 * unknown until a policy is accepted, and a failing check never changes it.
 *
 * @example
 * ```ts
 * const support = useSupport();
 * const unsupported = useSupport(beacon, ({ status }) => status === "unsupported");
 * ```
 */
export function useSupport(beacon?: ReactBeacon): SupportState;

export function useSupport<TSelected>(
  beacon: ReactBeacon,
  selector: (support: SupportState) => TSelected,
  options?: SelectorOptions<NoInfer<TSelected>>,
): TSelected;

export function useSupport(
  beacon?: ReactBeacon,
  selector: (support: SupportState) => unknown = selectValue,
  { isEqual = Object.is }: SelectorOptions<unknown> = {},
): unknown {
  const { support } = useResolvedBeacon(beacon, "useSupport");

  return useSelectedValue(support, selector, isEqual);
}
