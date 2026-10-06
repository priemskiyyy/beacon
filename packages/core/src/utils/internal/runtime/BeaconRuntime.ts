import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { BeaconStatus } from "src/types/BeaconStatus";
import type { ObservableValue } from "src/types/ObservableValue";
import type { RuntimePhase } from "src/types/internal/RuntimePhase";
import type { Session } from "src/types/internal/Session";
import {
  DISPOSED_STATUS,
  IDLE_STATUS,
  STOPPED_STATUS,
} from "src/utils/constants/status";
import { createDisposedError } from "src/utils/internal/errors/createDisposedError";
import type { Listeners } from "src/utils/internal/observable/Listeners";
import { ValueStore } from "src/utils/internal/observable/ValueStore";
import { ResourceScope } from "src/utils/internal/runtime/ResourceScope";

type BeaconRuntimeOptions = {
  listeners: Listeners;
  /** Opens what a new session owns; it may reenter, so it checks the session after every outside call. */
  onStart: (session: Session) => void;
  /** Runs once, after the last session has ended. */
  onDispose: () => void;
  record: (type: BeaconDiagnosticEventType) => void;
  reportCleanupError: (error: unknown) => void;
};

/** Owns the lifetime: one open session at a time, whose end silences everything that session started. */
export class BeaconRuntime {
  #phase: RuntimePhase = { state: "idle" };
  #sessions = 0;
  #status: ValueStore<BeaconStatus>;
  #onStart: BeaconRuntimeOptions["onStart"];
  #onDispose: BeaconRuntimeOptions["onDispose"];
  #record: BeaconRuntimeOptions["record"];
  #reportCleanupError: BeaconRuntimeOptions["reportCleanupError"];

  status: ObservableValue<BeaconStatus>;

  constructor({
    listeners,
    onStart,
    onDispose,
    record,
    reportCleanupError,
  }: BeaconRuntimeOptions) {
    this.#status = new ValueStore(IDLE_STATUS, listeners);
    this.status = this.#status.observable;
    this.#onStart = onStart;
    this.#onDispose = onDispose;
    this.#record = record;
    this.#reportCleanupError = reportCleanupError;
  }

  /** The open session, or `null`. */
  getSession = () => {
    if (this.#phase.state !== "running") {
      return null;
    }

    return this.#phase.session;
  };

  /**
   * Opens the session, or answers the stop of the one already open. The stop it
   * answers ends whichever session stands for its start, which a restart keeps,
   * and never one that an independent start opened.
   */
  start = () => {
    const phase = this.#phase;

    if (phase.state === "disposed") {
      throw createDisposedError();
    }

    if (phase.state === "running") {
      return phase.stop;
    }

    const stop = () => this.#end(stop);

    this.#open(stop);

    return stop;
  };

  /** Ends the open session and opens the next for the same start, so the stop that start answered still ends it. Nothing happens without an open session. */
  restart = () => {
    const phase = this.#phase;

    if (phase.state !== "running") {
      return;
    }

    const { stop } = phase;

    this.#end(stop);

    // A listener of the stopped status may have opened another session, or ended the Beacon, and that one stands.
    if (!this.#isIdle()) {
      return;
    }

    this.#open(stop);
  };

  stop = () => {
    const phase = this.#phase;

    if (phase.state !== "running") {
      return;
    }

    phase.stop();
  };

  dispose = () => {
    // A listener of the stopped status may open another session, which ends too.
    while (this.#phase.state === "running") {
      this.#end(this.#phase.stop);
    }

    // Already disposed, or a cleanup of the last session disposed it.
    if (this.#phase.state === "disposed") {
      return;
    }

    this.#phase = { state: "disposed" };
    this.#status.update(DISPOSED_STATUS);
    this.#status.close();
    this.#onDispose();
  };

  #open(stop: () => void) {
    this.#sessions += 1;

    const session: Session = {
      id: this.#sessions,
      resources: new ResourceScope(this.#reportCleanupError),
    };

    this.#phase = { state: "running", session, stop };

    // Whoever is called from here on may end this very session: an event's listener, a status listener, the opening itself.
    this.#record("session-started");

    if (!session.resources.isActive()) {
      return;
    }

    this.#status.update(
      Object.freeze({ state: "running", session: session.id }),
    );

    if (!session.resources.isActive()) {
      return;
    }

    this.#onStart(session);
  }

  // The cleanups run before the stop is published, so a listener that starts the next session finds every resource of this one released.
  #end(stop: () => void) {
    const phase = this.#phase;

    if (phase.state !== "running") {
      return;
    }

    if (phase.stop !== stop) {
      return;
    }

    this.#phase = { state: "idle" };
    this.#record("session-stopped");
    phase.session.resources.dispose();

    // A cleanup may have opened the next session or ended the Beacon, and the status that one published stands.
    if (!this.#isIdle()) {
      return;
    }

    this.#status.update(STOPPED_STATUS);
  }

  #isIdle() {
    return this.#phase.state === "idle";
  }
}
