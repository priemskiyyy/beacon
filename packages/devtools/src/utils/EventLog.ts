import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";

import type { RecordedEvent } from "src/types/internal/RecordedEvent";
import { clampLimit } from "src/utils/clampLimit";
import { copyEvent } from "src/utils/copyEvent";

/** The events recorded while the inspector is mounted: newest first, bounded in number and in size, and notified once per microtask. */
export class EventLog {
  #events: RecordedEvent[] = [];
  #listeners = new Set<() => void>();
  #limit: number;
  #last = 0;
  #lastFailure = 0;
  #scheduled = false;

  constructor(limit: number) {
    this.#limit = clampLimit(limit);
  }

  get = () => this.#events;

  /** The id of the newest event ever recorded, which survives a clear. */
  getLastId = () => this.#last;

  /** The id of the newest failure ever recorded, or 0, which survives a clear and the events that push its record out. */
  getLastFailureId = () => this.#lastFailure;

  setLimit = (limit: number) => {
    this.#limit = clampLimit(limit);

    if (this.#events.length <= this.#limit) {
      return;
    }

    this.#events = this.#events.slice(0, this.#limit);
    this.#notify();
  };

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  };

  add = (event: BeaconDiagnosticEvent) => {
    this.#last += 1;

    const entry = copyEvent(event, this.#last);

    if (entry.failure) {
      this.#lastFailure = entry.id;
    }

    this.#events = [entry, ...this.#events].slice(0, this.#limit);
    this.#notify();
  };

  clear = () => {
    this.#events = [];
    this.#notify();
  };

  #notify() {
    if (this.#scheduled) {
      return;
    }

    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;

      for (const listener of this.#listeners) {
        listener();
      }
    });
  }
}
