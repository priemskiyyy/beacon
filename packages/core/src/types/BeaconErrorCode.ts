/**
 * What went wrong, for an error Beacon itself created.
 *
 * - `INVALID_CONFIGURATION`: options or a call that cannot work, such as an
 *   unknown route name or a hook used outside its provider.
 * - `DISPOSED`: an operation ran after `dispose()`.
 *
 * @example
 * ```ts
 * const code: BeaconErrorCode = "DISPOSED";
 * ```
 */
export type BeaconErrorCode = "INVALID_CONFIGURATION" | "DISPOSED";
