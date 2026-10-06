import type { RouteDeclaration } from "src/types/RouteDeclaration";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardDecision } from "src/types/StandardDecision";

// An overload pair, the one place a mapped type is built from names known only
// at runtime: the signature promises each route the decisions its declaration
// allows, and `read` keeps that promise by reading each route from its own
// declaration alone.
export function mapDecisions<TDeclarations extends RouteDeclarations>(
  declarations: TDeclarations,
  read: (name: string, declaration: RouteDeclaration) => unknown,
): { [TName in keyof TDeclarations]: StandardDecision<TDeclarations[TName]> };

export function mapDecisions(
  declarations: RouteDeclarations,
  read: (name: string, declaration: RouteDeclaration) => unknown,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(declarations).map(([name, declaration]) => [
      name,
      read(name, declaration),
    ]),
  );
}
