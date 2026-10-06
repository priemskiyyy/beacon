/**
 * One dot-separated prerelease identifier of a parsed SemVer. A numeric one
 * keeps its canonical decimal digits, so no size rounds it.
 *
 * @example
 * ```ts
 * const identifier: SemVerIdentifier = { kind: "numeric", value: "12" };
 * ```
 */
export type SemVerIdentifier = { kind: "numeric" | "text"; value: string };
