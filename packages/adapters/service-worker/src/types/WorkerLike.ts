import type { WorkerMessage } from "src/types/WorkerMessage";

/**
 * The part of a `ServiceWorker` the adapter uses. The real one satisfies it,
 * so a test can pass its own without a browser.
 *
 * @example
 * ```ts
 * const waiting: WorkerLike | null = registration.waiting;
 * ```
 */
export type WorkerLike = {
  state:
    | "parsed"
    | "installing"
    | "installed"
    | "activating"
    | "activated"
    | "redundant";
  postMessage(message: WorkerMessage): void;
  addEventListener(type: "statechange", listener: () => void): void;
  removeEventListener(type: "statechange", listener: () => void): void;
};
