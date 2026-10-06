/**
 * The part of CodePush's `DownloadProgress` the adapter reads: the bytes
 * received and the bytes expected. A fork that downloads a patch and then falls
 * back to the full archive reports a second stream with a total of its own.
 *
 * @example
 * ```ts
 * const progress: DownloadProgressLike = { receivedBytes: 1_024, totalBytes: 4_096 };
 * ```
 */
export type DownloadProgressLike = {
  receivedBytes: number;
  totalBytes: number;
};
