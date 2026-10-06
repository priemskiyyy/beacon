import type { ContainerLike } from "src/types/ContainerLike";
import type { RegistrationLike } from "src/types/RegistrationLike";
import type { ServiceWorkerWindow } from "src/types/ServiceWorkerWindow";
import type { WorkerMessage } from "src/types/WorkerMessage";

/**
 * Options for `serviceWorker()`. Every one is optional, and the browser is
 * reached only when a session opens or a command runs, so creating the route
 * touches no browser API. The adapter never registers, unregisters or replaces
 * a worker: the registration is the application's.
 *
 * @example
 * ```ts
 * serviceWorker({ registration: () => navigator.serviceWorker.getRegistration("/app/") });
 * ```
 */
export type ServiceWorkerOptions = {
  /** The container that announces controller changes, `navigator.serviceWorker` by default. */
  container?: ContainerLike;
  /** The registration, or a function that finds it later; the container's own registration by default. */
  registration?:
    RegistrationLike | (() => Promise<RegistrationLike | undefined>);
  /** The window a reload replaces, the global `window` by default. */
  target?: ServiceWorkerWindow;
  /** What the worker listens for to skip waiting, `{ type: "SKIP_WAITING" }` by default. */
  message?: WorkerMessage;
};
