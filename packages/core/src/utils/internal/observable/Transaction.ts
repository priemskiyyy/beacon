import type { ValueStore } from "src/utils/internal/observable/ValueStore";

// Installs every store of one change before any listener runs, so a listener
// of one store never reads another store's previous value.
export class Transaction {
  #notifications = new Set<() => void>();
  #effects: Array<() => void> = [];

  set = <TValue>(store: ValueStore<TValue>, value: TValue) => {
    if (!store.set(value)) {
      return;
    }

    this.#notifications.add(store.notify);
  };

  /** Runs after every listener, for a step whose own listeners may call back, such as an abort. */
  after = (effect: () => void) => {
    this.#effects.push(effect);
  };

  commit = () => {
    for (const notify of this.#notifications) {
      notify();
    }

    for (const effect of this.#effects) {
      effect();
    }
  };
}
