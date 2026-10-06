import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
import { useBeacon } from "./useBeacon.js";
export function useRoute(name, selector = selectValue, options = {}) {
    const beacon = useBeacon();
    return useSelectedValue(() => beacon.current.route(name).state, selector, options);
}
