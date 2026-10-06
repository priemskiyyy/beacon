import type { ServiceWorkerWindow } from "src/types/ServiceWorkerWindow";

/** The window to reload: the one given, else the global one, else none, as in a server render. */
export const getWindow = (
  target: ServiceWorkerWindow | undefined,
): ServiceWorkerWindow | null => {
  if (target !== undefined) {
    return target;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window;
};
