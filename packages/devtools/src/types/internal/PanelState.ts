export type PanelState =
  | { status: "OPEN"; autoFocus: boolean }
  | { status: "CLOSED"; autoFocus: boolean; closedAfter: number };
