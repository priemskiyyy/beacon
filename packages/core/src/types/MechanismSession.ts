/**
 * What a mechanism keeps open while a session runs: the native handle its
 * commands use, exposed as `route.native`, and an optional cleanup for what
 * the mechanism itself acquired. It never releases what the application owns.
 *
 * @example
 * ```ts
 * const session: MechanismSession<Browser> = { native: browser };
 * ```
 */
export type MechanismSession<TNative> = {
  native: TNative;
  dispose?: () => void;
};
