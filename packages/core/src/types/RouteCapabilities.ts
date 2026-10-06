import type { Impact } from "src/types/Impact";
import type { RequirementOf } from "src/types/internal/RequirementOf";
import type { TargetBinding } from "src/types/TargetBinding";

/**
 * What each command of a route declares, as constants: which reference it
 * needs, what it can do to the running application, and how tightly it is
 * bound. It is what a presentation reads to warn before it acts.
 *
 * @example
 * ```ts
 * const { impacts, binding } = beacon.route("web").capabilities.requestReload;
 * ```
 */
export type RouteCapabilities<TCommands> = {
  [TName in keyof TCommands]: {
    reference: RequirementOf<TCommands[TName]>;
    impacts: Impact[];
    binding: TargetBinding;
  };
};
