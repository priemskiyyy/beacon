import type { WorkerLike } from "src/types/WorkerLike";

/**
 * The part of a `ServiceWorkerRegistration` the adapter uses: its three
 * workers, the browser's own update check, and the event that announces a new
 * installing worker. The real one satisfies it.
 *
 * @example
 * ```ts
 * const registration: RegistrationLike = await navigator.serviceWorker.register("/sw.js");
 * ```
 */
export type RegistrationLike = {
  installing: WorkerLike | null;
  waiting: WorkerLike | null;
  active: WorkerLike | null;
  /** Asks the browser to fetch the worker script again; what it resolves is not used. */
  update(): Promise<unknown>;
  addEventListener(type: "updatefound", listener: () => void): void;
  removeEventListener(type: "updatefound", listener: () => void): void;
};
