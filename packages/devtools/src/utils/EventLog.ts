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
  #scheduled = false;

  constructor(limit: number) {
    this.#limit = clampLimit(limit);
  }

  get = () => this.#events;

  /** The id of the newest event ever recorded, which survives a clear. */
  getLastId = () => this.#last;

  setLimit = (limit: number) => {
    this.#limit = clampLimit(limit);

    if (this.#events.length <= this.#limit) {
      return;
    }

    this.#events = this.#events.slice(0, this.#limit);
    this.#notify();
  };

  subscribe = (listener: () => void) => {
    // Wrapped, so the same function subscribed twice is two subscriptions.
    const notify = () => listener();

    this.#listeners.add(notify);

    return () => {
      this.#listeners.delete(notify);
    };
  };

  add = (event: BeaconDiagnosticEvent) => {
    this.#last += 1;
    this.#events = [copyEvent(event, this.#last), ...this.#events].slice(
      0,
      this.#limit,
    );
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

      for (const listener of [...this.#listeners]) {
        if (!this.#listeners.has(listener)) {
          continue;
        }

        listener();
      }
    });
  }
}
