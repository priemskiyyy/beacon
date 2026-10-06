import type { ContainerLike } from "src/types/ContainerLike";

/** The page's service worker container, or none in a server render or an insecure context. */
export const getContainer = (): ContainerLike | null => {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator.serviceWorker ?? null;
};
