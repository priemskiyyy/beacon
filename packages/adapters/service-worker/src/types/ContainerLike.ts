import type { RegistrationLike } from "src/types/RegistrationLike";

/**
 * The part of a `ServiceWorkerContainer`, `navigator.serviceWorker`, the
 * adapter uses: the registration of this page's scope, and the event that
 * announces a new controlling worker. The real one satisfies it.
 *
 * @example
 * ```ts
 * const container: ContainerLike = navigator.serviceWorker;
 * ```
 */
export type ContainerLike = {
  getRegistration(): Promise<RegistrationLike | undefined>;
  addEventListener(type: "controllerchange", listener: () => void): void;
  removeEventListener(type: "controllerchange", listener: () => void): void;
};
