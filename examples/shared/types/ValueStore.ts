import type { ObservableValue } from "@priemskiyyy/beacon";

/** An observable the lab writes to; what it hands out is the read-only `ObservableValue`. */
export type ValueStore<T> = ObservableValue<T> & { set: (next: T) => void };
