import { BeaconError } from "@priemskiyyy/beacon";
import { getContext } from "svelte";
import { BEACON_CONTEXT } from "../context/BeaconContext.js";
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
export const useBeacon = () => {
    const beacon = getContext(BEACON_CONTEXT);
    if (beacon === undefined) {
        throw new BeaconError({
            code: "INVALID_CONFIGURATION",
            message: "useBeacon needs a BeaconProvider above it.",
        });
    }
    return beacon;
};
