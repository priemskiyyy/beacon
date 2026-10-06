/**
 * How a candidate's order is written in the manifest: `text` for a version a
 * strategy parses, such as a semantic version, and `integer` for a whole
 * number, such as a build number. It has to match the version strategy of the
 * route that reads the candidate.
 *
 * @example
 * ```ts
 * const order: OrderKind = "text";
 * ```
 */
export type OrderKind = "text" | "integer";
