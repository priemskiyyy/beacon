import type { DownloadProgressLike } from "src/types/DownloadProgressLike";

/** The fraction of a download that is done, or `null` when CodePush gave no total, a count that is no number or is negative, or more bytes received than expected: a total is never invented. */
export const readProgress = ({
  receivedBytes,
  totalBytes,
}: DownloadProgressLike) => {
  if (!Number.isFinite(receivedBytes) || !Number.isFinite(totalBytes)) {
    return null;
  }

  if (totalBytes <= 0 || receivedBytes < 0 || receivedBytes > totalBytes) {
    return null;
  }

  return receivedBytes / totalBytes;
};
