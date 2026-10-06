/**
 * The tunable limits of a manifest, which have documented defaults: a decoded
 * document of at most 256 KiB, a lifetime of at most 24 hours, and a clock
 * skew of at most 5 minutes for a document issued in the future.
 *
 * @example
 * ```ts
 * const limits: ManifestLimits = { bytes: 65_536, lifetime: 600_000, skew: 60_000 };
 * ```
 */
export type ManifestLimits = {
  /** The most bytes a document may have. */
  bytes: number;
  /** The most milliseconds between when a document is issued and when it expires. */
  lifetime: number;
  /** The most milliseconds a document may be issued ahead of the local clock. */
  skew: number;
};
