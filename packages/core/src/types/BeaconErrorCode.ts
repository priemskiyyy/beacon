/**
 * What went wrong, for an error Beacon itself created.
 *
 * - `INVALID_CONFIGURATION`: options or a call that cannot work, such as an
 *   unknown route name or a hook used outside its provider.
 * - `DISPOSED`: an operation ran after `dispose()`.
 * - `NOT_STARTED`: an operation that needs an open session ran without one.
 * - `DRIVER_FAILED`: a provider driver could not open, or its check failed.
 * - `INVALID_VERSION`: a version string or number broke the grammar of the
 *   strategy that parsed it.
 * - `SELECTION_FAILED`: a version strategy threw while parsing or comparing.
 * - `IDENTITY_CONFLICT`: one release identity was reported with contradictory
 *   order or compatibility.
 * - `SOURCE_FAILED`: a release source rejected, threw or answered something
 *   Beacon could not accept.
 * - `SOURCE_TIMEOUT`: a release source or a provider took longer than its
 *   deadline.
 * - `INVALID_DOCUMENT`: a source answered a document whose revision, scope or
 *   times broke the contract.
 * - `ABORTED`: every caller stopped waiting, so the read was abandoned.
 * - `RUNNING_READ_FAILED`: the local reader of a running fact threw, rejected
 *   or took too long.
 * - `REVISION_REGRESSION`: an authority's decision revision went backwards, or
 *   an unversioned decision followed a versioned one.
 * - `REVISION_CONFLICT`: one decision revision arrived with different content.
 * - `REVISION_EPOCH_CHANGED`: a revision arrived from another domain or epoch,
 *   which is never assumed to be newer.
 * - `COMMAND_FAILED`: a provider command threw, so it reports a failure that
 *   did not take effect.
 *
 * @example
 * ```ts
 * const code: BeaconErrorCode = "DISPOSED";
 * ```
 */
export type BeaconErrorCode =
  | "INVALID_CONFIGURATION"
  | "DISPOSED"
  | "NOT_STARTED"
  | "DRIVER_FAILED"
  | "INVALID_VERSION"
  | "SELECTION_FAILED"
  | "IDENTITY_CONFLICT"
  | "SOURCE_FAILED"
  | "SOURCE_TIMEOUT"
  | "INVALID_DOCUMENT"
  | "ABORTED"
  | "RUNNING_READ_FAILED"
  | "REVISION_REGRESSION"
  | "REVISION_CONFLICT"
  | "REVISION_EPOCH_CHANGED"
  | "COMMAND_FAILED";
