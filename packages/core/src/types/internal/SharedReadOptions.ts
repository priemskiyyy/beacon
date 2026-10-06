import type { BeaconClock } from "src/types/BeaconClock";
import type { SharedReadErrors } from "src/types/internal/SharedReadErrors";
import type { SharedReadHooks } from "src/types/internal/SharedReadHooks";

/** What a shared read needs: how to ask, how to judge the answer, and who hears of it. */
export type SharedReadOptions<TAnswer, TAccepted> = {
  clock: BeaconClock;
  timeout: number;
  /** Asks once; a throw and a rejection are both a failed read. `signal` aborts when nobody waits anymore. */
  perform: (context: {
    attempt: number;
    signal: AbortSignal;
  }) => TAnswer | PromiseLike<TAnswer>;
  /** Judges the answer of the current read, or throws the error that rejects it. */
  accept: (attempt: number, answer: TAnswer) => TAccepted;
  hooks: SharedReadHooks<TAccepted>;
  errors: SharedReadErrors;
};
