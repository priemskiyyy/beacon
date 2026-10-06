export type PanelState =
  | { status: "open"; autoFocus: boolean }
  | { status: "closed"; autoFocus: boolean; closedAfter: number };
