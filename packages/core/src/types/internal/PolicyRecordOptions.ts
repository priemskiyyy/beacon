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
  /** Whether the route is open and has a command that acts with no offer or with one, such as the store page of a forced upgrade. */
  runsWithoutOffer: (name: string) => boolean;
  /** Told when an evaluation fails, once for each evaluation that does, with what the policy threw if it threw. */
  onFailure: (error: BeaconError, cause?: unknown) => void;
  /** Epoch milliseconds, for judging whether an evaluation that is kept still holds. */
  now: () => number;
};
