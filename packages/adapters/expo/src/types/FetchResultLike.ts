import type { ManifestLike } from "src/types/ManifestLike";

/**
 * The part of `UpdateFetchResult` the adapter reads, in all three of its
 * variants: a new update, a rollback to the embedded update, and a valid
 * answer that is neither. The real result satisfies it.
 *
 * @example
 * ```ts
 * const result: FetchResultLike = await Updates.fetchUpdateAsync();
 * ```
 */
export type FetchResultLike =
  | { isNew: true; isRollBackToEmbedded: false; manifest: ManifestLike }
  | { isNew: false; isRollBackToEmbedded: false; manifest: undefined }
  | { isNew: false; isRollBackToEmbedded: true; manifest: undefined };
