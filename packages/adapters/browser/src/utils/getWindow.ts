import type { BrowserWindowLike } from "src/types/BrowserWindowLike";

/** The global window, or none in a server render. */
export const getWindow = (): BrowserWindowLike | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window;
};
