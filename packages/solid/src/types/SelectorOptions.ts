/**
 * How a primitive decides that a new selection is the same as the last one,
 * so what depends on it does not run again.
 *
 * @example
 * ```ts
 * const options: SelectorOptions<string[]> = {
 *   isEqual: (previous, next) => previous.join() === next.join(),
 * };
 * ```
 */
export type SelectorOptions<TSelected> = {
  /** `Object.is` by default. */
  isEqual?: (previous: TSelected, next: TSelected) => boolean;
};
