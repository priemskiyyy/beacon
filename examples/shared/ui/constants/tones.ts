import type {
  BeaconStatus,
  CheckState,
  CommandOutcome,
  Evidence,
  Observation,
  OperationState,
  ReconciliationOutcome,
  RouteBody,
  RunningFact,
  SupportStatus,
  TransitionState,
} from "@priemskiyyy/beacon";

import type { TimelineSource } from "example-shared/lab/types/TimelineSource";
import type { Tone } from "example-shared/ui/types/Tone";

export const SESSION_TONES: Record<BeaconStatus["state"], Tone> = {
  idle: "neutral",
  running: "positive",
  stopped: "warning",
  disposed: "neutral",
};

export const CHECK_TONES: Record<CheckState["state"], Tone> = {
  idle: "neutral",
  checking: "info",
  succeeded: "positive",
  failed: "danger",
};

export const OBSERVATION_TONES: Record<
  Observation<string, RouteBody>["status"],
  Tone
> = {
  unknown: "warning",
  none: "neutral",
  available: "accent",
  inconclusive: "warning",
};

export const RUNNING_TONES: Record<RunningFact["state"], Tone> = {
  unconfigured: "neutral",
  pending: "warning",
  known: "positive",
  failed: "danger",
};

export const SUPPORT_TONES: Record<SupportStatus, Tone> = {
  unknown: "warning",
  supported: "positive",
  deprecated: "warning",
  unsupported: "danger",
};

export const FRESHNESS_TONES: Record<Evidence["freshness"], Tone> = {
  fresh: "positive",
  expired: "warning",
};

export const OPERATION_TONES: Record<OperationState["state"], Tone> = {
  idle: "neutral",
  running: "info",
  indeterminate: "warning",
};

export const OUTCOME_TONES: Record<
  CommandOutcome<{ kind: string }>["status"],
  Tone
> = {
  accepted: "positive",
  blocked: "warning",
  stale: "warning",
  unsupported: "neutral",
  cancelled: "neutral",
  failed: "danger",
  indeterminate: "warning",
};

export const RECONCILIATION_TONES: Record<ReconciliationOutcome, Tone> = {
  "same-boot": "info",
  "target-running": "positive",
  "target-not-running": "danger",
  "different-target": "warning",
  inconclusive: "warning",
};

export const JOURNAL_TONES: Record<TransitionState["journal"], Tone> = {
  off: "neutral",
  reading: "info",
  ready: "positive",
  degraded: "danger",
};

export const TIMELINE_SOURCE_TONES: Record<TimelineSource, Tone> = {
  diagnostic: "accent",
  transition: "positive",
  world: "neutral",
};
