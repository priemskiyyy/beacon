/**
 * The part of `UpdateCheckResult` the adapter reads, in all three of its
 * variants: an available update, a rollback to the embedded update, and a
 * valid answer with neither, whose `reason` is the SDK's own code. Of an
 * update's manifest it reads the id its server assigns. The real result
 * satisfies it.
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
      manifest: { id: string };
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
