import type { Remediation } from "src/types/Remediation";

/**
 * A remediation with whether its route is usable now: it has an offer or a
 * prepared target, or it is open and has a command that acts with no offer,
 * such as `openStore` of a store route. A provider may still refuse that
 * command, as a store handoff does a build of another distribution, and the
 * outcome says why. `unsupported` with nothing usable is a state to show as it
 * is, with retry or a restricted mode, and not one to answer with an endless
 * redirect.
 *
 * @example
 * ```ts
 * const stuck = state.remediation.every(({ usable }) => !usable);
 * ```
 */
export type RemediationState = Remediation & { usable: boolean };
