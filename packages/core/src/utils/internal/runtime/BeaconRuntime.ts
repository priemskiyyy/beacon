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
  #phase: RuntimePhase = { state: "IDLE" };
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

  /** The number of the open session, or `null`. */
  getSession = () => {
    if (this.#phase.state !== "RUNNING") {
      return null;
    }

    return this.#phase.session;
  };

  /**
   * Opens the session, or answers the stop of the one already open. The stop it
   * answers ends only its own session, so an old one can never end a newer one.
   */
  start = () => {
    const phase = this.#phase;

    if (phase.state === "DISPOSED") {
      throw createDisposedError();
    }

    if (phase.state === "RUNNING") {
      return phase.stop;
    }

    this.#sessions += 1;

    const session: Session = {
      id: this.#sessions,
      scope: new ResourceScope(this.#reportCleanupError),
    };

    const stop = () => this.#end(session);

    this.#phase = { state: "RUNNING", session, stop };
    this.#record("session-started");
    this.#status.update(
      Object.freeze({ state: "running", session: session.id }),
    );

    // A status listener may have stopped or disposed this very session.
    if (!session.scope.isActive()) {
      return stop;
    }

    this.#onStart(session);

    return stop;
  };

  stop = () => {
    const phase = this.#phase;

    if (phase.state !== "RUNNING") {
      return;
    }

    this.#end(phase.session);
  };

  dispose = () => {
    if (this.#phase.state === "DISPOSED") {
      return;
    }

    // A listener of the stopped status may open another session, which ends too.
    while (this.#phase.state === "RUNNING") {
      this.#end(this.#phase.session);
    }

    this.#phase = { state: "DISPOSED" };
    this.#status.update(DISPOSED_STATUS);
    this.#status.close();
    this.#onDispose();
  };

  // The cleanups run before the stop is published, so a listener that starts the next session finds every resource of this one released.
  #end(session: Session) {
    const phase = this.#phase;

    if (phase.state !== "RUNNING") {
      return;
    }

    if (phase.session !== session) {
      return;
    }

    this.#phase = { state: "STOPPED" };
    this.#record("session-stopped");
    session.scope.dispose();
    this.#status.update(STOPPED_STATUS);
  }
}
