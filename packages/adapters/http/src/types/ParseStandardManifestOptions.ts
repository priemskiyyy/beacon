import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { ManifestLimits } from "src/types/ManifestLimits";
import type { RouteDeclarations } from "src/types/RouteDeclarations";

/**
 * What parsing a manifest needs: the text, the scope it has to speak for, the
 * routes the application reads, and the local time in epoch milliseconds,
 * which the caller reads after the response arrived.
 *
 * @example
 * ```ts
 * parseStandardManifest({
 *   text,
 *   scope,
 *   routes: { web: { kind: "target" } },
 *   now: Date.now(),
 * });
 * ```
 */
export type ParseStandardManifestOptions<
  TDeclarations extends RouteDeclarations,
> = {
  text: string;
  scope: ReleaseScope;
  routes: TDeclarations;
  now: number;
  limits?: Partial<ManifestLimits>;
};
