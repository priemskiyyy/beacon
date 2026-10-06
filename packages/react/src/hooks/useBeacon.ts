import { useResolvedBeacon } from "src/hooks/internal/useResolvedBeacon";
import type { ReactBeacon } from "src/types/ReactBeacon";

/**
 * Returns the nearest provider's Beacon and throws when the provider is
 * missing. Reading it starts nothing.
 *
 * @example
 * ```ts
 * const beacon = useBeacon();
 * ```
 */
export const useBeacon = (): ReactBeacon =>
  useResolvedBeacon(undefined, "useBeacon");
