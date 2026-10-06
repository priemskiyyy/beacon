import type { DecisionRevision } from "@priemskiyyy/beacon";

import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardManifest } from "src/types/StandardManifest";

/**
 * A valid manifest with the evidence Beacon judges it by, all of it present:
 * the revision, a digest of the decision without its renewable times, and the
 * narrowest expiry. Answer it as `{ status: "changed", ...read }`.
 *
 * @example
 * ```ts
 * const read = parseStandardManifest({ text, scope, routes, now });
 * const answer = { status: "changed", ...read };
 * ```
 */
export type StandardRead<TDeclarations extends RouteDeclarations> = {
  document: StandardManifest<TDeclarations>;
  revision: DecisionRevision;
  digest: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};
