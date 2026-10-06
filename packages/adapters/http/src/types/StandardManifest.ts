import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardDecision } from "src/types/StandardDecision";
import type { StandardSupport } from "src/types/StandardSupport";

/**
 * The document of a valid standard manifest: one decision for each declared
 * route, and the support facts when the manifest carries them. Its scope,
 * revision and times were checked and became evidence, so they are not here.
 *
 * @example
 * ```ts
 * const web = manifest.select((document) => document.routes.web);
 * const support = manifest.select((document) => document.support);
 * ```
 */
export type StandardManifest<TDeclarations extends RouteDeclarations> = {
  routes: {
    [TName in keyof TDeclarations]: StandardDecision<TDeclarations[TName]>;
  };
  support: StandardSupport<keyof TDeclarations & string> | null;
};
