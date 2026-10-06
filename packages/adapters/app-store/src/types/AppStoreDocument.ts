import type { CandidateDecision, NoneDecision } from "@priemskiyyy/beacon";

import type { AppStoreMetadata } from "src/types/AppStoreMetadata";

/**
 * The document the lookup source answers: one decision, a candidate marketing
 * version, or none when the lookup context matched nothing. Select it for a
 * route: `lookup.select((document) => document.decision)`.
 *
 * @example
 * ```ts
 * const decision = lookup.select((document) => document.decision);
 * ```
 */
export type AppStoreDocument = {
  decision: CandidateDecision<string, AppStoreMetadata> | NoneDecision;
};
