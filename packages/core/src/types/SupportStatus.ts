/**
 * How acceptable the running application is under the application's own
 * policy. It is not installation eligibility, compatibility, or whether an
 * advertised release is newer. `unknown` is what it is until a policy is
 * accepted and after it lapses; it is never `supported` by default.
 *
 * @example
 * ```ts
 * const status: SupportStatus = "deprecated";
 * ```
 */
export type SupportStatus =
  "unknown" | "supported" | "deprecated" | "unsupported";
