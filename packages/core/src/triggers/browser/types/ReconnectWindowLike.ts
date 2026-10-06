/**
 * The part of a browser window the `reconnect` trigger uses: the `online`
 * event. The real `window` satisfies it, so a test or a frame can pass its
 * own without a DOM.
 *
 * @example
 * ```ts
 * import { reconnect } from "@priemskiyyy/beacon/triggers/browser";
 *
 * const back = reconnect({ target: window });
 * ```
 */
export type ReconnectWindowLike = {
  addEventListener(type: "online", listener: () => void): void;
  removeEventListener(type: "online", listener: () => void): void;
};
