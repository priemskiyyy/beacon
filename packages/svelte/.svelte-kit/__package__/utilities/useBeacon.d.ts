import type { ReadableValue } from "../types/ReadableValue.js";
import type { RegisteredBeacon } from "../types/Register.js";
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
export declare const useBeacon: () => ReadableValue<RegisteredBeacon>;
