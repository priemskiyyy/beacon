import type { PlayInstallEvent } from "src/types/PlayInstallEvent";

/** The fraction of the download done, or `null` when Play gave no total or a count that is no number: a total is never invented. */
export const readProgress = ({
  bytesDownloaded,
  totalBytes,
}: PlayInstallEvent) => {
  if (bytesDownloaded === null || totalBytes === null || totalBytes <= 0) {
    return null;
  }

  const fraction = bytesDownloaded / totalBytes;

  // A native module can hand over a count that is missing or not a number, though its type says otherwise.
  if (Number.isNaN(fraction)) {
    return null;
  }

  return Math.min(1, Math.max(0, fraction));
};
