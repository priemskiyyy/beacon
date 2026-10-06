import type { DecisionRevision } from "@priemskiyyy/beacon";

import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardManifest } from "src/types/StandardManifest";

/**
 * A valid manifest with the evidence Beacon judges it by: the revision when
 * the manifest numbers its decisions, a digest of the decision without its
 * renewable times, and the narrowest expiry. A manifest with no `expiresAt`
 * claims no expiry of its own, and its `expiresAt` here is the client's window,
 * the lifetime limit counted from when it was read. Answer it as
 * `{ status: "changed", ...read }`.
 *
 * @example
 * ```ts
 * const manifest = http({
 *   fetch: ({ scope }) => ({
 *     status: "changed",
 *     ...parseStandardManifest({ text, scope, routes, now: Date.now() }),
 *   }),
 * });
 * ```
 */
export type StandardRead<TDeclarations extends RouteDeclarations> = {
  document: StandardManifest<TDeclarations>;
  revision?: DecisionRevision;
  digest: string;
  /** Epoch milliseconds: the narrowest of the authority's expiry and the client's window. */
  expiresAt: number;
  /** Only when the manifest claimed no expiry: the milliseconds the client's window holds, which a not modified answer renews. */
  holdsFor?: number;
};
