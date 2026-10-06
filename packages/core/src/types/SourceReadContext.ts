import type { BeaconClock } from "src/types/BeaconClock";
import type { ReleaseScope } from "src/types/ReleaseScope";

/**
 * What a source read is given: the scope it speaks for, a signal that aborts
 * when nobody waits for the answer anymore, the number of the attempt, and the
 * clock the Beacon runs on. A source that dates its answer reads `clock.now()`
 * after the response arrived, so a test clock moves it with everything else
 * and no source reads the host's time.
 *
 * @example
 * ```ts
 * const read = async ({ scope, signal, clock }: SourceReadContext) => {
 *   const response = await fetch(`/releases/${scope.environment}.json`, { signal });
 *   const document = await response.json();
 *
 *   return { document, expiresAt: clock.now() + 600_000 };
 * };
 * ```
 */
export type SourceReadContext = {
  scope: ReleaseScope;
  signal: AbortSignal;
  attempt: number;
  clock: BeaconClock;
};
