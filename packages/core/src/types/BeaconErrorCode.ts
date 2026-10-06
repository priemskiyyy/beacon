/**
 * What went wrong, for an error Beacon itself created.
 *
 * - `INVALID_CONFIGURATION`: options or a call that cannot work, such as an
 *   unknown route name or a hook used outside its provider.
 * - `DISPOSED`: an operation ran after `dispose()`.
 * - `INVALID_VERSION`: a version string or number broke the grammar of the
 *   strategy that parsed it.
 * - `SELECTION_FAILED`: a version strategy threw while parsing or comparing.
 * - `IDENTITY_CONFLICT`: one release identity was reported with contradictory
 *   order or compatibility.
 * - `RUNNING_READ_FAILED`: the local reader of a running fact threw, rejected
 *   or took too long.
 * - `REVISION_REGRESSION`: an authority's decision revision went backwards, or
 *   an unversioned decision followed a versioned one.
 * - `REVISION_CONFLICT`: one decision revision arrived with different content.
 * - `REVISION_EPOCH_CHANGED`: a revision arrived from another domain or epoch,
 *   which is never assumed to be newer.
 *
 * @example
 * ```ts
 * const code: BeaconErrorCode = "DISPOSED";
 * ```
 */
export type BeaconErrorCode =
  | "INVALID_CONFIGURATION"
  | "DISPOSED"
  | "INVALID_VERSION"
  | "SELECTION_FAILED"
  | "IDENTITY_CONFLICT"
  | "RUNNING_READ_FAILED"
  | "REVISION_REGRESSION"
  | "REVISION_CONFLICT"
  | "REVISION_EPOCH_CHANGED";
