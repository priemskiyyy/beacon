import type { DriverEmitter } from "@priemskiyyy/beacon";

import type { ContainerLike } from "src/types/ContainerLike";
import type { WorkerReading } from "src/types/internal/WorkerReading";
import type { RegistrationLike } from "src/types/RegistrationLike";
import type { WorkerBody } from "src/types/WorkerBody";
import type { WorkerLike } from "src/types/WorkerLike";
import { observeWorkers } from "src/utils/observeWorkers";
import { readWorkers } from "src/utils/readWorkers";

type WorkerSessionOptions = {
  container: ContainerLike | null;
  resolve: () => Promise<RegistrationLike | undefined>;
  emit: DriverEmitter<WorkerBody, WorkerBody>;
};

/**
 * Owns what one session listens to: the registration once the application has
 * one, its workers, and the container's controller. It reports the workers'
 * state as it changes, remembers which worker the page was last known to run
 * under so an activation can be told from the first installation, and falls
 * silent for good when disposed.
 */
export class WorkerSession {
  #resolve: WorkerSessionOptions["resolve"];
  #emit: DriverEmitter<WorkerBody, WorkerBody>;
  #registration: RegistrationLike | undefined = undefined;
  #baseline: WorkerLike | null = null;
  #attached = new Set<RegistrationLike>();
  #stops: Array<() => void> = [];
  #disposed = false;

  constructor({ container, resolve, emit }: WorkerSessionOptions) {
    this.#resolve = resolve;
    this.#emit = emit;

    container?.addEventListener("controllerchange", this.#refresh);
    this.#stops.push(() =>
      container?.removeEventListener("controllerchange", this.#refresh),
    );
  }

  /** Reads the registration and the workers again, as after a restart or a return to the page, and reports them. */
  reconcile = async () => {
    const registration = await this.#resolve();

    if (this.#disposed) {
      return;
    }

    this.#attach(registration);
    this.#report(this.#read());
  };

  /** Asks the browser for a newer worker script, then answers what the workers say. */
  check = async () => {
    const registration = await this.#resolve();

    await registration?.update();
    this.#attach(registration);

    const reading = this.#read();

    if (!this.#disposed) {
      this.#emit.prepared(reading.prepared);
    }

    return reading.observation;
  };

  dispose = () => {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;

    for (const stop of this.#stops.splice(0).reverse()) {
      stop();
    }
  };

  #read(): WorkerReading {
    // The first worker to be active is the baseline, whether it was there when observation began or came from the first installation.
    if (this.#baseline === null && this.#registration?.active) {
      this.#baseline = this.#registration.active;
    }

    return readWorkers(this.#registration, this.#baseline);
  }

  #report({ observation, prepared }: WorkerReading) {
    if (this.#disposed) {
      return;
    }

    this.#emit.observation(observation);
    this.#emit.prepared(prepared);
  }

  #refresh = () => {
    this.#report(this.#read());
  };

  // A registration that is gone is gone: what was read from it is not offered any more.
  #attach(registration: RegistrationLike | undefined) {
    if (this.#disposed) {
      return;
    }

    this.#registration = registration;

    if (registration === undefined || this.#attached.has(registration)) {
      return;
    }

    this.#attached.add(registration);
    this.#stops.push(observeWorkers(registration, this.#refresh));
  }
}
