import type { ValueStore } from "src/utils/internal/observable/ValueStore";

// Installs every store of one change before any listener runs, so a listener
// of one store never reads another store's previous value.
export class Transaction {
  #notifications = new Set<() => void>();

  set = <TValue>(store: ValueStore<TValue>, value: TValue) => {
    if (!store.set(value)) {
      return;
    }

    this.#notifications.add(store.notify);
  };

  commit = () => {
    for (const notify of this.#notifications) {
      notify();
    }
  };
}
