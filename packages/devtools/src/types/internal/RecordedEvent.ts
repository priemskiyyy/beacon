/** A bounded plain copy of one diagnostic event, so the history retains nothing but text and numbers. */
export type RecordedEvent = {
  id: number;
  type: string;
  timestamp: number;
  session: number | null;
  route: string | null;
  command: string | null;
  attempt: number | null;
  operation: number | null;
  reason: string | null;
  failure: boolean;
};
