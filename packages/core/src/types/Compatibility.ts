/**
 * Whether a release can run in the environment that would receive it. It is
 * neither the provider's eligibility to hand it out nor the application's
 * support policy, and an absent value is not evidence of compatibility.
 *
 * @example
 * ```ts
 * const compatibility: Compatibility = { status: "compatible", basis: "runtime-version" };
 * const delegated: Compatibility = { status: "delegated", authority: "google-play" };
 * ```
 */
export type Compatibility =
  | { status: "compatible"; basis: string }
  | { status: "incompatible"; reasons: string[] }
  | { status: "delegated"; authority: string }
  | { status: "unknown"; reason: string }
  | { status: "not-applicable" };
