import type { BrowserWindowLike } from "src/types/BrowserWindowLike";

/** The window to reload: the one given, else the global one, else none, as in a server render. */
export const getWindow = (
  target: BrowserWindowLike | undefined,
): BrowserWindowLike | null => {
  if (target !== undefined) {
    return target;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window;
};
