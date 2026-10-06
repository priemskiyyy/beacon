import type { ManifestLike } from "src/types/ManifestLike";

/**
 * The part of `UpdateCheckResult` the adapter reads, in all three of its
 * variants: an available update, a rollback to the embedded update, and a
 * valid answer with neither, whose `reason` is the SDK's own code. The real
 * result satisfies it.
 *
 * @example
 * ```ts
 * const result: CheckResultLike = await Updates.checkForUpdateAsync();
 * ```
 */
export type CheckResultLike =
  | {
      isAvailable: true;
      isRollBackToEmbedded: false;
      manifest: ManifestLike;
      reason: undefined;
    }
  | {
      isAvailable: false;
      isRollBackToEmbedded: true;
      manifest: undefined;
      reason: undefined;
    }
  | {
      isAvailable: false;
      isRollBackToEmbedded: false;
      manifest: undefined;
      reason: string;
    };
