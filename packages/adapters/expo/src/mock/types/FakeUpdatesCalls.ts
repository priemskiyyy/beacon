/**
 * How many times each method of a fake `expo-updates` module was called.
 *
 * @example
 * ```ts
 * const calls: FakeUpdatesCalls = { checks: 0, fetches: 0, reloads: 0 };
 * ```
 */
export type FakeUpdatesCalls = {
  checks: number;
  fetches: number;
  reloads: number;
};
