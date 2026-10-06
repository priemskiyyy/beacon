import type { Remediation } from "src/types/Remediation";

/**
 * A remediation with whether its route is usable now: it has an offer or a
 * prepared target. `unsupported` with nothing usable is a state to show as it
 * is, with retry or a restricted mode, and not one to answer with an endless
 * redirect.
 *
 * @example
 * ```ts
 * const stuck = state.remediation.every(({ usable }) => !usable);
 * ```
 */
export type RemediationState = Remediation & { usable: boolean };
