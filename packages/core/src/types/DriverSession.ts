import type { ObservationDraft } from "src/types/ObservationDraft";
import type { RouteBody } from "src/types/RouteBody";

/**
 * A provider driver's open session. `check` asks the provider and reports what
 * it says; `reconcile` reads the provider's current local state again, after a
 * restart or a return to the foreground, and reports it through the emitter.
 * Neither installs anything.
 *
 * @example
 * ```ts
 * const session: DriverSession<Updates, PlayOffer> = {
 *   native: updates,
 *   check: async () => ({ status: "none", reason: "no-decision", detail: null }),
 * };
 * ```
 */
export type DriverSession<TNative, TOffer extends RouteBody> = {
  native: TNative;
  check(context: { signal: AbortSignal }): Promise<ObservationDraft<TOffer>>;
  reconcile?(context: { signal: AbortSignal }): Promise<void>;
  dispose?: () => void;
};
