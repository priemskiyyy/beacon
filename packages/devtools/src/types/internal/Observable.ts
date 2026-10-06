/** The part of a Beacon observable, or of the event log, that a view reads. */
export type Observable<TValue> = {
  get: () => TValue;
  subscribe: (listener: () => void) => () => void;
};
