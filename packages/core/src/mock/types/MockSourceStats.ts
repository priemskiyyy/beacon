/**
 * What a mock source has been asked so far.
 *
 * @example
 * ```ts
 * expect(mock.stats()).toEqual({ reads: 1, held: 1, aborted: 0 });
 * ```
 */
export type MockSourceStats = {
  /** Reads Beacon started. */
  reads: number;
  /** Reads still waiting for the test to settle them. */
  held: number;
  /** Reads whose signal aborted. */
  aborted: number;
};
