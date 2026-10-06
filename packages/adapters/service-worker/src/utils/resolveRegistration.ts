import type { ContainerLike } from "src/types/ContainerLike";
import type { RegistrationLike } from "src/types/RegistrationLike";
import type { ServiceWorkerOptions } from "src/types/ServiceWorkerOptions";

/** How to find the registration: the one given, the one a function finds, or the container's own, else never any. */
export const resolveRegistration = (
  container: ContainerLike | null,
  registration: ServiceWorkerOptions["registration"],
): (() => Promise<RegistrationLike | undefined>) => {
  if (typeof registration === "function") {
    return registration;
  }

  if (registration !== undefined) {
    return async () => registration;
  }

  if (container !== null) {
    return () => container.getRegistration();
  }

  return async () => undefined;
};
