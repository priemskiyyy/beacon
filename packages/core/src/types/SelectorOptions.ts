/**
 * How a framework binding decides that a new selection is the same as the last
 * one, so what depends on it does not render or run again. Every binding takes
 * it as the last argument of its reading functions and re-exports it.
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
