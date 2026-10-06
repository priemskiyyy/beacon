import type { PlayInstallEvent } from "src/types/PlayInstallEvent";

/** The fraction of the download done, or `null` when Play gave no total: a total is never invented. */
export const readProgress = ({
  bytesDownloaded,
  totalBytes,
}: PlayInstallEvent) => {
  if (bytesDownloaded === null || totalBytes === null || totalBytes <= 0) {
    return null;
  }

  return Math.min(1, Math.max(0, bytesDownloaded / totalBytes));
};
