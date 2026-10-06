/** What an event says beyond its type; the session and time come from the recorder. */
export type DiagnosticDetails = {
  route?: string;
  attempt?: number;
  operation?: number;
  reason?: string;
};
