import type { BeaconClock } from "src/types/BeaconClock";
import type { BeaconDiagnosticCounters } from "src/types/BeaconDiagnosticCounters";
import type { BeaconDiagnosticEvent } from "src/types/BeaconDiagnosticEvent";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { BeaconDiagnostics } from "src/types/BeaconDiagnostics";
import type { BeaconDiagnosticSnapshot } from "src/types/BeaconDiagnosticSnapshot";
import type { BeaconStatus } from "src/types/BeaconStatus";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import {
  COUNTED_EVENTS,
  INITIAL_DIAGNOSTICS,
} from "src/utils/constants/diagnostics";
import { isSameData } from "src/utils/internal/common/isSameData";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { isolate } from "src/utils/internal/reporting/isolate";
import { reportUnhandledError } from "src/utils/internal/reporting/reportUnhandledError";

type EventRegistration = { listener: (event: BeaconDiagnosticEvent) => void };

type DiagnosticsOptions = {
  clock: BeaconClock;
  /** The number of the open session, read only when an event or the snapshot is built. */
  getSession: () => number | null;
  /** Where the session stands, read only when the snapshot is read. */
  getStatus: () => BeaconStatus["state"];
};

// Diagnostics never create demand: an event is built only while someone
// listens, and the snapshot is assembled only when read.
export class Diagnostics {
  #clock: BeaconClock;
  #getSession: DiagnosticsOptions["getSession"];
  #getStatus: DiagnosticsOptions["getStatus"];
  #events = new Set<EventRegistration>();
  #queue: BeaconDiagnosticEvent[] = [];
  #delivering = false;
  #snapshotListeners = new Listeners(reportUnhandledError);
  #counters: BeaconDiagnosticCounters = {
    lateCallbacks: 0,
    listenerErrors: 0,
    cleanupErrors: 0,
  };

  #snapshot: BeaconDiagnosticSnapshot | null = null;
  #announcing = false;
  #closed = false;

  constructor({ clock, getSession, getStatus }: DiagnosticsOptions) {
    this.#clock = clock;
    this.#getSession = getSession;
    this.#getStatus = getStatus;
  }

  record = (
    type: BeaconDiagnosticEventType,
    details: DiagnosticDetails = {},
  ) => {
    if (this.#closed) {
      return;
    }

    const counter = COUNTED_EVENTS[type];

    if (counter !== null) {
      this.#counters[counter] += 1;
    }

    this.#announceLater();

    if (this.#events.size === 0) {
      return;
    }

    this.#queue.push(this.#createEvent(type, details));
    this.#deliver();
  };

  /** Delivers the final snapshot at once and ends every observation. */
  close = () => {
    if (this.#closed) {
      return;
    }

    this.#snapshotListeners.notify();
    this.#closed = true;
    this.#snapshotListeners.clear();
    this.#events.clear();
    this.#queue = [];
  };

  view: BeaconDiagnostics = Object.freeze({
    get: () => this.#getSnapshot(),
    getInitial: () => INITIAL_DIAGNOSTICS,
    subscribe: (listener: () => void) => {
      if (this.#closed) {
        return () => {};
      }

      return this.#snapshotListeners.add(listener);
    },
    events: Object.freeze({
      subscribe: (listener: (event: BeaconDiagnosticEvent) => void) => {
        if (this.#closed) {
          return () => {};
        }

        const registration: EventRegistration = { listener };

        this.#events.add(registration);

        return () => {
          this.#events.delete(registration);
        };
      },
    }),
  });

  // Collected on every read, since the status moves it without an event of
  // its own; an equal snapshot keeps its identity.
  #getSnapshot() {
    const previous = this.#snapshot;

    const next: BeaconDiagnosticSnapshot = Object.freeze({
      status: this.#getStatus(),
      session: this.#getSession(),
      counters: Object.freeze({ ...this.#counters }),
    });

    if (previous !== null && isSameData(previous, next)) {
      return previous;
    }

    this.#snapshot = next;

    return next;
  }

  // Tells the snapshot's observers once the current work is done.
  #announceLater() {
    if (this.#announcing) {
      return;
    }

    if (this.#snapshotListeners.size() === 0) {
      return;
    }

    this.#announcing = true;
    queueMicrotask(this.#announce);
  }

  #announce = () => {
    this.#announcing = false;

    if (this.#closed) {
      return;
    }

    this.#snapshotListeners.notify();
  };

  #createEvent(
    type: BeaconDiagnosticEventType,
    { route, command, attempt, operation, reason, cause }: DiagnosticDetails,
  ): BeaconDiagnosticEvent {
    return Object.freeze({
      type,
      timestamp: this.#clock.now(),
      session: this.#getSession(),
      route: route ?? null,
      command: command ?? null,
      attempt: attempt ?? null,
      operation: operation ?? null,
      reason: reason ?? null,
      cause: cause ?? null,
    });
  }

  // An event a listener raises waits behind the one being delivered, so every listener hears the events in the order they happened.
  #deliver() {
    if (this.#delivering) {
      return;
    }

    this.#delivering = true;

    let event = this.#queue.shift();

    while (event !== undefined) {
      this.#emit(event);
      event = this.#queue.shift();
    }

    this.#delivering = false;
  }

  // A throwing event listener is rethrown outside, never recorded, so it cannot loop.
  #emit(event: BeaconDiagnosticEvent) {
    for (const registration of [...this.#events]) {
      if (!this.#events.has(registration)) {
        continue;
      }

      isolate(() => registration.listener(event), reportUnhandledError);
    }
  }
}
