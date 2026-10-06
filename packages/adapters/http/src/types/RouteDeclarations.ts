import type { RouteDeclaration } from "src/types/RouteDeclaration";

/**
 * The routes the application reads from a manifest, by name. A route that is
 * not declared is never read, and a declared route the manifest lacks is a
 * validation error.
 *
 * @example
 * ```ts
 * const routes: RouteDeclarations = {
 *   web: { kind: "target" },
 *   binary: { kind: "candidate", order: "text" },
 * };
 * ```
 */
export type RouteDeclarations = Record<string, RouteDeclaration>;
