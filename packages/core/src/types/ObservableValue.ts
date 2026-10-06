/**
 * A readable snapshot with change notifications. `get` returns the same object
 * until something meaningful changes, and `subscribe` never calls back at once,
 * never starts a check and never acquires an update. `getInitial` is the
 * snapshot before anything happened: a server never starts a session, so it is
 * what a server renders, and what a hydrating render has to read.
 *
 * @example
 * ```ts
 * const stop = beacon.state.subscribe(() => {
 *   console.info(beacon.state.get().revision);
 * });
 * const beforeAnySession = beacon.state.getInitial();
 * ```
 */
export type ObservableValue<TValue> = {
  get: () => TValue;
  getInitial: () => TValue;
  subscribe: (listener: () => void) => () => void;
};
