import type { DriverEmitter } from "@priemskiyyy/beacon";

import type { ContainerLike } from "src/types/ContainerLike";
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
    this.#attach(await this.#resolve());
    this.#refresh();
  };

  /** Asks the browser for a newer worker script, then answers what the workers say. */
  check = async () => {
    const registration = await this.#resolve();

    // Watched before it is asked: the worker the update finds is heard as it installs, and a registration whose update fails is still known.
    this.#attach(registration);
    await registration?.update();

    const reading = this.#read();

    if (!this.#disposed) {
      this.#emit.prepared(reading.prepared);
    }

    return reading.observation;
  };

  dispose = () => {
    this.#disposed = true;

    for (const stop of this.#stops.splice(0).reverse()) {
      stop();
    }
  };

  #read() {
    this.#noteBaseline();

    return readWorkers(this.#registration, this.#baseline);
  }

  // The first worker to be active is the baseline, whether it was there when observation began or came from the first installation.
  #noteBaseline() {
    if (this.#baseline !== null) {
      return;
    }

    this.#baseline = this.#registration?.active ?? null;
  }

  #refresh = () => {
    if (this.#disposed) {
      return;
    }

    const { observation, prepared } = this.#read();

    // The two are reported one after the other. The target goes first, so that after an activation an observer sees the offer beside the target for a moment, and never a route with neither.
    this.#emit.prepared(prepared);

    // A listener told of the target can stop the session before the observation is reported.
    if (this.#disposed) {
      return;
    }

    this.#emit.observation(observation);
  };

  // A registration that is gone is gone: what was read from it is not offered any more.
  #attach(registration: RegistrationLike | undefined) {
    if (this.#disposed) {
      return;
    }

    this.#registration = registration;
    this.#noteBaseline();

    if (registration === undefined || this.#attached.has(registration)) {
      return;
    }

    this.#attached.add(registration);
    this.#stops.push(observeWorkers(registration, this.#refresh));
  }
}
