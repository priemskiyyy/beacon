import { selectValue } from "../utils/selectValue.js";
import { useSelectedValue } from "./internal/useSelectedValue.svelte.js";
export function useObservable(value, selector = selectValue, options = {}) {
    return useSelectedValue(() => value, selector, options);
}
