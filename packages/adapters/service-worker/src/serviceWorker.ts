import { createReleaseDriver } from "@priemskiyyy/beacon";
import type { CommandMap } from "@priemskiyyy/beacon";

import type { ServiceWorkerNative } from "src/types/ServiceWorkerNative";
import type { ServiceWorkerOptions } from "src/types/ServiceWorkerOptions";
import type { WorkerBody } from "src/types/WorkerBody";
import { SKIP_WAITING_MESSAGE } from "src/utils/constants/messages";
import { NO_DOCUMENT, NO_REGISTRATION } from "src/utils/constants/reasons";
import { getContainer } from "src/utils/getContainer";
import { getWindow } from "src/utils/getWindow";
import { getWorkerId } from "src/utils/getWorkerId";
import { resolveRegistration } from "src/utils/resolveRegistration";
import { WorkerSession } from "src/utils/WorkerSession";

const createCommands = ({
  target,
  message = SKIP_WAITING_MESSAGE,
}: ServiceWorkerOptions) =>
  ({
    activateWaiting: {
      reference: "offer",
      impacts: ["worker-takeover"],
      binding: "exact-instance",
      run: async ({ native, offer }) => {
        const registration = await native.registration();

        if (registration === undefined) {
          return { status: "unsupported", reason: NO_REGISTRATION };
        }

        const { waiting } = registration;

        // The offer is about one worker; a replaced or activated one is no longer that offer.
        if (waiting === null || getWorkerId(waiting) !== offer.worker.id) {
          return { status: "stale" };
        }

        waiting.postMessage(message);

        return {
          status: "accepted",
          receipt: {
            kind: "activation-requested",
            worker: { id: offer.worker.id },
          },
        };
      },
    },
    requestReload: {
      reference: "prepared",
      impacts: ["document-replacement"],
      binding: "provider-current",
      run: async () => {
        const window = getWindow(target);

        if (window === null) {
          return { status: "unsupported", reason: NO_DOCUMENT };
        }

        window.location.reload();

        return { status: "accepted", receipt: { kind: "reload-requested" } };
      },
    },
  }) satisfies CommandMap<ServiceWorkerNative, WorkerBody, WorkerBody>;

/**
 * A service worker registration as a Beacon route. A waiting worker, next to
 * one that is already active, is an update that is ready: `activateWaiting`
 * asks that worker to skip waiting, which proves no activation. Once the
 * worker that was active has been replaced, the route has a prepared target
 * and `requestReload` replaces the document. The release stays unknown,
 * because the bytes behind a script URL can change. The adapter never
 * registers or unregisters a worker, and activating one is a takeover that
 * reaches every tab of the scope, not only this one.
 *
 * @example
 * ```ts
 * const routes = {
 *   worker: serviceWorker({ registration: () => navigator.serviceWorker.getRegistration() }),
 * };
 * ```
 */
export const serviceWorker = (options: ServiceWorkerOptions = {}) =>
  createReleaseDriver<
    ServiceWorkerNative,
    WorkerBody,
    WorkerBody,
    ReturnType<typeof createCommands>
  >({
    name: "service-worker",
    prepares: true,
    open: ({ emit }) => {
      const container = options.container ?? getContainer();
      const registration = resolveRegistration(container, options.registration);

      const session = new WorkerSession({
        container,
        resolve: registration,
        emit,
      });

      return {
        native: { container, registration },
        check: session.check,
        reconcile: session.reconcile,
        dispose: session.dispose,
      };
    },
    commands: createCommands(options),
  });
