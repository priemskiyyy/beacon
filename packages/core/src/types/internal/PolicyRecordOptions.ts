import type { ErasedPolicy } from "src/types/internal/ErasedPolicy";
import type { RouteState } from "src/types/internal/RouteState";
import type { BeaconError } from "src/utils/BeaconError";
import type { Listeners } from "src/utils/internal/observable/Listeners";

/** What the policy record is built from. */
export type PolicyRecordOptions = {
  /** `null` when the Beacon has no policy. */
  policy: ErasedPolicy | null;
  listeners: Listeners;
  /** The published state of a route, or `undefined` when there is no such route. */
  getRoute: (name: string) => RouteState | undefined;
  /** Told when an evaluation fails, once for each evaluation that does. */
  onFailure: (error: BeaconError) => void;
  /** Epoch milliseconds, for judging whether an evaluation that is kept still holds. */
  now: () => number;
};
