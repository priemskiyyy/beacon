import { onMount } from "solid-js";

/** A ref that focuses its element once on mount when enabled, so opening moves focus while a restored panel does not steal it. */
export const useAutoFocus = (enabled: boolean) => (node: HTMLElement) => {
  if (!enabled) {
    return;
  }

  onMount(() => node.focus());
};
