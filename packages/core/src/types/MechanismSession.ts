/**
 * What a mechanism, or a driver, keeps open while a session runs: the native
 * handle its commands use, exposed as `route.native`, and an optional cleanup
 * for what it acquired itself. It never releases what the application owns.
 *
 * @example
 * ```ts
 * const session: MechanismSession<Browser> = { native: browser };
 * ```
 */
export type MechanismSession<TNative extends object> = {
  native: TNative;
  dispose?: () => void;
};
