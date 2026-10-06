import type { MechanismSession } from "src/types/MechanismSession";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { RouteBody } from "src/types/RouteBody";

/**
 * A provider driver's open session: what a mechanism's session keeps (the
 * `native` handle and its `dispose`), and the two ways the provider is read.
 * `check` asks the provider and reports what it says. `reconcile` runs once,
 * as the session opens, reads the provider's current local state, such as what
 * a restart left behind, and reports it through the emitter. Neither installs
 * anything.
 *
 * @example
 * ```ts
 * const session: DriverSession<Updates, PlayOffer> = {
 *   native: updates,
 *   check: async () => ({ status: "none", reason: "no-decision", detail: null }),
 * };
 * ```
 */
export type DriverSession<
  TNative extends object,
  TOffer extends RouteBody,
> = MechanismSession<TNative> & {
  check(context: { signal: AbortSignal }): Promise<ObservationDraft<TOffer>>;
  reconcile?(context: { signal: AbortSignal }): Promise<void>;
};
