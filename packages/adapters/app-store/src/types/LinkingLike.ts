/**
 * The part of React Native's `Linking` the handoff uses. The real one
 * satisfies it, and a test passes its own.
 *
 * @example
 * ```ts
 * const linking: LinkingLike = Linking;
 * ```
 */
export type LinkingLike = {
  /** Resolves when the OS accepted the navigation; what it resolves is not used. */
  openURL(url: string): Promise<unknown>;
};
