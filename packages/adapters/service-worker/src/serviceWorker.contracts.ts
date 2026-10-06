// Typechecked, never run: the real DOM service worker types satisfy the
// structural ones the adapter uses, and a route's methods are derived from
// the commands the driver declares.
import type {
  OfferReference,
  PreparedReference,
  RouteHandle,
} from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import { serviceWorker } from "src/serviceWorker";
import type { ActivationReceipt } from "src/types/ActivationReceipt";
import type { ContainerLike } from "src/types/ContainerLike";
import type { RegistrationLike } from "src/types/RegistrationLike";
import type { ServiceWorkerNative } from "src/types/ServiceWorkerNative";
import type { ServiceWorkerWindow } from "src/types/ServiceWorkerWindow";
import type { WorkerLike } from "src/types/WorkerLike";
import type { WorkerReloadReceipt } from "src/types/WorkerReloadReceipt";

export const container: ContainerLike = navigator.serviceWorker;

declare const registration: ServiceWorkerRegistration;

export const given: RegistrationLike = registration;

declare const instance: ServiceWorker;

export const like: WorkerLike = instance;

export const target: ServiceWorkerWindow = window;

export const worker = serviceWorker({ container, registration });

// @ts-expect-error -- a container announces controller changes; an object without events is not one.
serviceWorker({ container: { getRegistration: async () => undefined } });

declare const handle: RouteHandle<"worker", typeof worker>;

declare const offer: OfferReference<"worker">;

declare const prepared: PreparedReference<"worker">;

export const activation = handle.activate({ offer });

export const reload = handle.reload({ prepared });

// @ts-expect-error -- an activation needs the offer, not the prepared target.
handle.activate({ offer: prepared });

// @ts-expect-error -- a reload needs a prepared target, which only an observed activation gives.
handle.reload({ prepared: offer });

export const native: ServiceWorkerNative | null = handle.native.get();

export const receipt = async () => {
  const settled = await handle.activate({ offer });

  if (settled.status === "accepted") {
    expectTypeOf(settled.receipt).toEqualTypeOf<ActivationReceipt>();

    // @ts-expect-error -- an accepted activation request proves no activation.
    return settled.receipt.activated;
  }

  return null;
};

export const reloadReceipt = async () => {
  const settled = await handle.reload({ prepared });

  if (settled.status === "accepted") {
    expectTypeOf(settled.receipt).toEqualTypeOf<WorkerReloadReceipt>();

    // @ts-expect-error -- an accepted reload proves no update.
    return settled.receipt.updated;
  }

  return null;
};
