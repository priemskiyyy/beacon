import type { BeaconError } from "src/utils/BeaconError";
import type { SupportVerdict } from "src/types/SupportVerdict";

/** What evaluating the policy came to, kept for as long as neither the accepted feed nor the running facts change. */
export type PolicyEvaluation =
  // The record's own copy of the verdict, so the application changing what it answered changes nothing published.
  | { status: "evaluated"; verdict: SupportVerdict }
  | { status: "failed"; error: BeaconError };
