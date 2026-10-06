/**
 * Where Play's install of an update stands, as its API names it. It is a
 * provider fact about the transfer, never a fact about what is running.
 *
 * @example
 * ```ts
 * const status: PlayInstallStatus = "downloaded";
 * ```
 */
export type PlayInstallStatus =
  | "unknown"
  | "pending"
  | "downloading"
  | "downloaded"
  | "installing"
  | "installed"
  | "failed"
  | "canceled";
