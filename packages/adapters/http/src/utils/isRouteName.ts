import type { RouteDeclarations } from "src/types/RouteDeclarations";

/** Whether a name is one of the routes the application declared, which is what tells the compiler it is a key of them. */
export const isRouteName = <TDeclarations extends RouteDeclarations>(
  declarations: TDeclarations,
  name: string,
): name is keyof TDeclarations & string =>
  Object.keys(declarations).includes(name);
