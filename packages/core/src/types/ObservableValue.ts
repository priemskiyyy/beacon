/**
 * A readable snapshot with change notifications. `get` returns the same object
 * until something meaningful changes, and `subscribe` never calls back at once,
 * never starts a check and never acquires an update.
 *
 * @example
 * ```ts
 * const stop = beacon.state.subscribe(() => {
 *   console.info(beacon.state.get().revision);
 * });
 * ```
 */
export type ObservableValue<TValue> = {
  get: () => TValue;
  subscribe: (listener: () => void) => () => void;
};
