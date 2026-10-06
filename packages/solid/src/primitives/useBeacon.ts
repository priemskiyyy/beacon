import type { Accessor } from "solid-js";

import { useProvidedBeacon } from "src/primitives/internal/useProvidedBeacon";
import type { RegisteredBeacon } from "src/types/Register";

/**
 * Follows the nearest provider's Beacon as an accessor, typed by the one the
 * application registered, and throws when the provider is missing. Reading it
 * starts nothing.
 *
 * @example
 * ```ts
 * const beacon = useBeacon();
 * const outcome = await beacon().route("web").reload({ offer });
 * ```
 */
export const useBeacon = (): Accessor<RegisteredBeacon> =>
  useProvidedBeacon("useBeacon");
