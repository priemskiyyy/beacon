import { WEB_ARTIFACT_DOMAIN } from "@priemskiyyy/beacon/adapter";
import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { IdentityShorthand } from "src/types/internal/IdentityShorthand";
import type { RouteDeclaration } from "src/types/RouteDeclaration";

/**
 * What an identity written as a text means on a route: the application
 * assigns it, and the route names the domain, or a `target` route names the
 * web artifact, which is what a web build is. A `candidate` route is a
 * binary or a bundle, and nothing says which, so it has no domain until it
 * declares one.
 */
export const createIdentityShorthand = (
  declaration: RouteDeclaration,
  scope: ReleaseScope,
): IdentityShorthand => {
  if (declaration.domain !== undefined) {
    return { authority: scope.application, domain: declaration.domain };
  }

  if (declaration.kind === "target") {
    return { authority: scope.application, domain: WEB_ARTIFACT_DOMAIN };
  }

  return { authority: scope.application, domain: null };
};
