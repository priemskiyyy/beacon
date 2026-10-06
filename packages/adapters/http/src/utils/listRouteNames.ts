import type { RouteDeclarations } from "src/types/RouteDeclarations";

// An overload pair: the names of a declaration are its keys, which the type system cannot tell an `Object.keys` call.
export function listRouteNames<TDeclarations extends RouteDeclarations>(
  declarations: TDeclarations,
): Array<keyof TDeclarations & string>;

export function listRouteNames(declarations: RouteDeclarations): string[] {
  return Object.keys(declarations);
}
