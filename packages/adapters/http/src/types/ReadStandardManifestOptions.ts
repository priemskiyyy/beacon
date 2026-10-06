import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { ManifestLimits } from "src/types/ManifestLimits";
import type { ManifestResponse } from "src/types/ManifestResponse";
import type { RouteDeclarations } from "src/types/RouteDeclarations";

/**
 * What reading a manifest response needs: the response, and what
 * `ParseStandardManifestOptions` names for its body.
 *
 * @example
 * ```ts
 * readStandardManifest({
 *   response: await fetch("/releases.json", { signal }),
 *   scope,
 *   routes: { web: { kind: "target" } },
 *   now: Date.now(),
 * });
 * ```
 */
export type ReadStandardManifestOptions<
  TDeclarations extends RouteDeclarations,
> = {
  response: ManifestResponse;
  scope: ReleaseScope;
  routes: TDeclarations;
  now: number;
  limits?: Partial<ManifestLimits>;
};
