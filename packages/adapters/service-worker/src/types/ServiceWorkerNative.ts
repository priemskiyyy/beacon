import type { ContainerLike } from "src/types/ContainerLike";
import type { RegistrationLike } from "src/types/RegistrationLike";

/**
 * What the route exposes as `route.native`: the container when there is one,
 * and a way to find the registration, which is `undefined` until the
 * application registers a worker. Calling a worker directly bypasses Beacon's
 * admission.
 *
 * @example
 * ```ts
 * const registration = await beacon.route("worker").native.get()?.registration();
 * ```
 */
export type ServiceWorkerNative = {
  container: ContainerLike | null;
  registration: () => Promise<RegistrationLike | undefined>;
};
