import { useProvidedBeacon } from "src/hooks/internal/useProvidedBeacon";
import type { RegisteredBeacon } from "src/types/Register";

/**
 * Returns the nearest provider's Beacon, typed by the one the application
 * registered, and throws when the provider is missing. Reading it starts
 * nothing.
 *
 * @example
 * ```ts
 * const outcome = await useBeacon().route("web").reload({ offer });
 * ```
 */
export const useBeacon = (): RegisteredBeacon => useProvidedBeacon("useBeacon");
