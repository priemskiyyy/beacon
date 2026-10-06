import type {
  BeaconDiagnosticEventType,
  InconclusiveReason,
  NoOfferReason,
  ReconciliationOutcome,
  StaleReason,
  SupportUnknownReason,
  UnknownReason,
} from "@priemskiyyy/beacon";

import type { TimelineSource } from "example-shared/lab/types/TimelineSource";

export const TIMELINE_SOURCE_LABELS: Record<TimelineSource, string> = {
  diagnostic: "Beacon",
  transition: "Journal",
  world: "World",
};

export const DIAGNOSTIC_LABELS: Record<BeaconDiagnosticEventType, string> = {
  "session-started": "Session started",
  "session-stopped": "Session stopped",
  disposed: "Disposed",
  "running-read": "Read what runs",
  "running-failed": "Reading what runs failed",
  "check-requested": "Check requested",
  "route-failed": "Route failed",
  "policy-failed": "Support policy failed",
  "journal-read": "Journal read",
  "journal-ignored": "Journal record ignored",
  "journal-failed": "Journal failed",
  "ready-reported": "Ready reported",
  "command-admitted": "Command admitted",
  "command-settled": "Command settled",
  "read-started": "Read started",
  "read-accepted": "Read accepted",
  "read-renewed": "Read renewed the held decision",
  "read-failed": "Read failed",
  "read-abandoned": "Read abandoned",
  "late-callback": "Late callback dropped",
  "listener-error": "Listener error contained",
  "cleanup-error": "Cleanup error contained",
};

export const NO_OFFER_LABELS: Record<NoOfferReason, string> = {
  "no-decision": "the service has no release for this scope",
  "same-identity": "the service names the build that runs",
  "equal-order": "the candidate orders equal to what runs",
  "equal-order-different-identity":
    "the candidate is another build of equal order",
  "older-than-current": "the candidate is older than what runs",
  "not-admitted": "the version strategy does not admit the candidate",
  incompatible: "the release cannot run where it would be installed",
};

export const INCONCLUSIVE_LABELS: Record<InconclusiveReason, string> = {
  "missing-current-identity": "what runs has no known identity",
  "missing-current-order": "what runs has no order to compare",
  "incomparable-identity": "the identities belong to different authorities",
  "incomparable-order": "the version strategy could not order the values",
};

export const RECONCILIATION_LABELS: Record<ReconciliationOutcome, string> = {
  "same-boot": "no new boot yet, so the reload may still be unresolved",
  "target-running": "a new boot runs the target it aimed at",
  "target-not-running": "a new boot runs what ran before",
  "different-target": "a new boot runs something else than it aimed at",
  inconclusive: "an identity is unknown or incomparable",
};

export const STALE_LABELS: Record<StaleReason, string> = {
  foreign: "Beacon did not mint this reference",
  replaced: "the offer was replaced",
  expired: "the evidence behind the offer no longer holds",
  "provider-changed": "the provider no longer has that target",
};

export const BLOCK_LABELS: Record<string, string> = {
  "unsaved-draft": "the draft has unsaved changes",
  "operation-in-progress": "another operation is running",
  "operation-indeterminate": "an earlier reload is still unresolved",
  "safety-changed": "the participants changed while the command waited",
};

export const UNKNOWN_LABELS: Record<UnknownReason, string> = {
  "not-checked": "nothing has been accepted yet",
  "unsupported-environment": "this environment cannot check",
};

export const SUPPORT_UNKNOWN_LABELS: Record<SupportUnknownReason, string> = {
  "no-policy": "no policy is configured",
  "not-checked": "no policy was accepted yet",
  expired: "the accepted policy lapsed",
  "evaluation-failed": "the policy could not be evaluated",
};
