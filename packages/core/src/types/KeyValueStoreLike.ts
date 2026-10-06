/**
 * The three calls every key-value store has, under the names of the Web
 * Storage API: `localStorage`, `sessionStorage`, AsyncStorage and
 * `expo-sqlite/kv-store` satisfy it as they are. A store may answer at once or
 * later, answers `null` or `undefined` for a key nothing was written under,
 * and may return whatever it likes from `setItem` and `removeItem`, which is
 * never read.
 *
 * @example
 * ```ts
 * const store: KeyValueStoreLike = localStorage;
 * ```
 */
export type KeyValueStoreLike = {
  getItem(
    key: string,
  ): string | null | undefined | Promise<string | null | undefined>;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
};
