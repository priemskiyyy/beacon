/** What an event says beyond its type, each part left out or `undefined` when it does not apply; the session and time come from the recorder. */
export type DiagnosticDetails = {
  route?: string | undefined;
  command?: string | undefined;
  attempt?: number | undefined;
  operation?: number | undefined;
  reason?: string | undefined;
  /** The raw value a failure threw, kept only in the event. */
  cause?: unknown;
};
