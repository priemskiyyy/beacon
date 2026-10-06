import type { WorkerMessage } from "src/types/WorkerMessage";

/**
 * The part of a `ServiceWorker` the adapter uses: it posts a message to one
 * and listens to its state changes. The real one satisfies it, so a test can
 * pass its own without a browser.
 *
 * @example
 * ```ts
 * const waiting: WorkerLike | null = registration.waiting;
 * ```
 */
export type WorkerLike = {
  postMessage(message: WorkerMessage): void;
  addEventListener(type: "statechange", listener: () => void): void;
  removeEventListener(type: "statechange", listener: () => void): void;
};
