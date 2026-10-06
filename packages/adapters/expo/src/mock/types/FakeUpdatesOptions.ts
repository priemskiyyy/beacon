/**
 * What `createFakeUpdates` pretends to be: the build's update server and the
 * build itself.
 *
 * @example
 * ```ts
 * const options: FakeUpdatesOptions = { available: true };
 * ```
 */
export type FakeUpdatesOptions = {
  /** Whether the update server has an update for this build. It is the same update on every check and every fetch. `false` by default. */
  available?: boolean;
  /** Whether updates are off in this build, as in a development build or Expo Go: nothing runs from an update and every call is refused the way the SDK refuses it. `false` by default. */
  disabled?: boolean;
};
