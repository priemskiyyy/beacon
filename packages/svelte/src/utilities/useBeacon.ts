import type { ReadableValue } from "../types/ReadableValue.js";
import type { RegisteredBeacon } from "../types/Register.js";
import { useProvidedBeacon } from "./internal/useProvidedBeacon.js";

/**
 * Follows the nearest provider's Beacon through `current`, typed by the one
 * the application registered, and throws `INVALID_CONFIGURATION` when the
 * provider is missing. Reading it starts nothing.
 *
 * @example
 * ```ts
 * const beacon = useBeacon();
 *
 * const outcome = await beacon.current.route("web").reload({ offer });
 * ```
 */
export const useBeacon = (): ReadableValue<RegisteredBeacon> =>
  useProvidedBeacon("useBeacon");
