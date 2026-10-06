import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { JsonRecord } from "src/types/internal/JsonRecord";
import type { RouteDeclaration } from "src/types/RouteDeclaration";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardDecision } from "src/types/StandardDecision";
import { createIdentityShorthand } from "src/utils/createIdentityShorthand";
import { invalidManifest } from "src/utils/invalidManifest";
import { readDecision } from "src/utils/readDecision";
import { readField } from "src/utils/readField";
import { readRecord } from "src/utils/readRecord";

// An overload pair, the one place a mapped type is built from names known only
// at runtime: the signature promises each route the decisions its declaration
// allows, and the implementation keeps that promise by reading each route from
// its own declaration alone.
export function readRoutes<TDeclarations extends RouteDeclarations>(
  record: JsonRecord,
  declarations: TDeclarations,
  scope: ReleaseScope,
): {
  [TName in keyof TDeclarations]: StandardDecision<TDeclarations[TName]>;
};

/** The decision of every declared route. A route the manifest lacks is a refusal, never a decision to offer nothing. */
export function readRoutes(
  record: JsonRecord,
  declarations: RouteDeclarations,
  scope: ReleaseScope,
): Record<string, StandardDecision<RouteDeclaration>> {
  const decisions = readRecord(readField(record, "routes"), "routes");

  return Object.fromEntries(
    Object.entries(declarations).map(([name, declaration]) => {
      const decision = readField(decisions, name);

      if (decision === undefined) {
        throw invalidManifest(`routes.${name} is missing.`);
      }

      return [
        name,
        readDecision(
          decision,
          `routes.${name}`,
          declaration,
          createIdentityShorthand(declaration, scope),
        ),
      ];
    }),
  );
}
