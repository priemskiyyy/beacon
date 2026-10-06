import type { ObservableValue } from "src/types/ObservableValue";
import { Listeners } from "src/utils/internal/observable/Listeners";

export class ValueStore<TValue> {
  #value: TValue;
  #notified: TValue;
  #listeners: Listeners;
  #closed = false;

  constructor(initialValue: TValue, listeners = new Listeners()) {
    this.#value = initialValue;
    this.#notified = initialValue;
    this.#listeners = listeners;
  }

  get = () => this.#value;

  subscribe = (listener: () => void) => {
    if (this.#closed) {
      return () => {};
    }

    return this.#listeners.add(listener);
  };

  /** Installs a value without notifying, so an owner can install several before any listener reads one. */
  set = (value: TValue) => {
    if (Object.is(value, this.#value)) {
      return false;
    }

    this.#value = value;

    return true;
  };

  // A nested transaction may have announced this value already.
  notify = () => {
    if (Object.is(this.#value, this.#notified)) {
      return;
    }

    this.#notified = this.#value;
    this.#listeners.notify();
  };

  update = (value: TValue) => {
    if (!this.set(value)) {
      return;
    }

    this.notify();
  };

  /** Stops every pass and refuses new listeners; the last value stays readable. */
  close = () => {
    this.#closed = true;
    this.#listeners.clear();
  };

  /** The read side, for owners that must not hand out `set`. */
  observable: ObservableValue<TValue> = Object.freeze({
    get: this.get,
    subscribe: this.subscribe,
  });
}
