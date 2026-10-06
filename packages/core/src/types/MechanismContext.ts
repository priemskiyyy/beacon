import type { ReleaseScope } from "src/types/ReleaseScope";

/**
 * What a mechanism is given when its route opens: the scope the session runs
 * under, which is the new one after `replaceScope`. A mechanism that only needs
 * its own options ignores it.
 *
 * @example
 * ```ts
 * const open = ({ scope }: MechanismContext) => ({ native: { distribution: scope.distribution } });
 * ```
 */
export type MechanismContext = { scope: ReleaseScope };
