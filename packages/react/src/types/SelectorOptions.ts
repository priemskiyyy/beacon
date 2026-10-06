/**
 * How a hook decides that a new selection is the same as the last one, so
 * the component does not render again.
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
