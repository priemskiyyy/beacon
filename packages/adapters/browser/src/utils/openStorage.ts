import type { KeyValueStoreLike } from "@priemskiyyy/beacon";

import type { BrowserStorageArea } from "src/types/BrowserStorageArea";
import type { BrowserStorageWindowLike } from "src/types/BrowserStorageWindowLike";

const PROPERTIES: Record<BrowserStorageArea, keyof BrowserStorageWindowLike> = {
  session: "sessionStorage",
  local: "localStorage",
};

/**
 * The storage of the window, reached now and never held: there is none in a
 * server render, and reading the property itself throws a `SecurityError`
 * where site data is blocked, as in a sandboxed frame or with cookies
 * refused. A missing window throws an error of its own, and a blocked one
 * throws that error with the browser's as its cause.
 */
export const openStorage = (
  area: BrowserStorageArea,
  target: BrowserStorageWindowLike | undefined,
): KeyValueStoreLike => {
  const host = target ?? (typeof window === "undefined" ? null : window);

  if (host === null) {
    throw new Error(
      "There is no window to keep the journal in, as in a server render.",
    );
  }

  try {
    return host[PROPERTIES[area]];
  } catch (cause) {
    throw new Error(
      "The browser refuses web storage here, as a sandboxed frame or blocked site data does.",
      { cause },
    );
  }
};
