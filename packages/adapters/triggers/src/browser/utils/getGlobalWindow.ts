/**
 * The global window of a browser, or none where there is not one: a server
 * render has no `window`, and React Native's is its global object, which has
 * no document. A trigger then leaves it alone.
 */
export const getGlobalWindow = (): Window | null => {
  if (typeof window === "undefined" || typeof window.document !== "object") {
    return null;
  }

  return window;
};
