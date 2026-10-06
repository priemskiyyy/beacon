import type { BeaconClock } from "src/types/BeaconClock";
import type { BeaconDiagnosticCounters } from "src/types/BeaconDiagnosticCounters";
import type { BeaconDiagnosticEvent } from "src/types/BeaconDiagnosticEvent";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { BeaconDiagnostics } from "src/types/BeaconDiagnostics";
import type { BeaconDiagnosticSnapshot } from "src/types/BeaconDiagnosticSnapshot";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import {
  COUNTED_EVENTS,
  INITIAL_DIAGNOSTICS,
} from "src/utils/constants/diagnostics";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { isolate } from "src/utils/internal/reporting/isolate";
import { reportUnhandledError } from "src/utils/internal/reporting/reportUnhandledError";

type EventRegistration = { listener: (event: BeaconDiagnosticEvent) => void };

type DiagnosticsOptions = {
  clock: BeaconClock;
  /** The number of the open session, read only when an event is built. */
  getSession: () => number | null;
  /** The snapshot's own facts, read only when the snapshot is read. */
  collect: (counters: BeaconDiagnosticCounters) => BeaconDiagnosticSnapshot;
};

// Diagnostics never create demand: an event is built only while someone
// listens, and the snapshot is assembled only when read.
export class Diagnostics {
  #clock: BeaconClock;
  #getSession: DiagnosticsOptions["getSession"];
  #collect: DiagnosticsOptions["collect"];
  #events = new Set<EventRegistration>();
  #snapshotListeners = new Listeners();
  #counters: BeaconDiagnosticCounters = {
    lateCallbacks: 0,
    listenerErrors: 0,
    cleanupErrors: 0,
  };

  #snapshot: BeaconDiagnosticSnapshot | null = null;
  #announcing = false;
  #closed = false;

  constructor({ clock, getSession, collect }: DiagnosticsOptions) {
    this.#clock = clock;
    this.#getSession = getSession;
    this.#collect = collect;
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

    this.changed();

    if (this.#events.size === 0) {
      return;
    }

    this.#emit(this.#createEvent(type, details));
  };

  /** Tells the snapshot's observers once the current work is done. */
  changed = () => {
    if (this.#announcing) {
      return;
    }

    if (this.#snapshotListeners.size() === 0) {
      return;
    }

    this.#announcing = true;
    queueMicrotask(this.#announce);
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

  // Collected on every read, since time and changes without an event move it
  // too; an equal snapshot keeps its identity. It is plain data built in one
  // key order, so its JSON tells equal ones apart.
  #getSnapshot() {
    const previous = this.#snapshot;
    const next = this.#collect(Object.freeze({ ...this.#counters }));

    if (
      previous !== null &&
      JSON.stringify(previous) === JSON.stringify(next)
    ) {
      return previous;
    }

    this.#snapshot = next;

    return next;
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
    { route, command, attempt, operation, reason }: DiagnosticDetails,
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
    });
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
