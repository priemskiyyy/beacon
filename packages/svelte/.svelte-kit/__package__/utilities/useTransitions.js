import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
import { useBeacon } from "./useBeacon.js";
export function useTransitions(selector = selectValue, options = {}) {
    const beacon = useBeacon();
    return useSelectedValue(() => beacon.current.transitions, selector, options);
}
