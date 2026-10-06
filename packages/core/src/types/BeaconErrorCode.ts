/**
 * What went wrong, for an error Beacon itself created.
 *
 * - `INVALID_CONFIGURATION`: options or a call that cannot work, such as an
 *   unknown route name or a hook used outside its provider.
 * - `DISPOSED`: an operation ran after `dispose()`.
 * - `INVALID_VERSION`: a version string or number broke the grammar of the
 *   strategy that parsed it.
 *
 * @example
 * ```ts
 * const code: BeaconErrorCode = "DISPOSED";
 * ```
 */
export type BeaconErrorCode =
  "INVALID_CONFIGURATION" | "DISPOSED" | "INVALID_VERSION";
