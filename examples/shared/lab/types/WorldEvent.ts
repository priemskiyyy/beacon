/** Something the scripted world did, for the timeline. */
export type WorldEvent =
  | { type: "booted"; build: number }
  | { type: "published"; build: number }
  | { type: "required"; build: number }
  | { type: "rolled-back"; build: number }
  | { type: "no-update" }
  | { type: "ended"; build: number }
  | { type: "manifest-failing"; failing: boolean }
  | { type: "manifest-slow"; slow: boolean }
  | { type: "manifest-answered"; reads: number }
  | { type: "time-skipped"; milliseconds: number }
  | { type: "draft"; dirty: boolean }
  | { type: "deployment-lagging"; lagging: boolean }
  | { type: "reload-requested" }
  | { type: "reset" };
