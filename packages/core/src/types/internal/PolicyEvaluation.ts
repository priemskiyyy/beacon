import type { BeaconError } from "src/utils/BeaconError";
import type { SupportVerdict } from "src/types/SupportVerdict";

/** What evaluating the policy came to, kept for as long as neither the document nor the running facts change. */
export type PolicyEvaluation =
  | { status: "evaluated"; verdict: SupportVerdict }
  | { status: "failed"; error: BeaconError };
