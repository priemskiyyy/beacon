import type { PlayInstallStatus } from "src/types/PlayInstallStatus";

/**
 * One report of Play's install state. The byte counts are `null` when Play
 * gave none, and a total is never invented.
 *
 * @example
 * ```ts
 * const event: PlayInstallEvent = { status: "downloading", bytesDownloaded: 1_024, totalBytes: 4_096 };
 * ```
 */
export type PlayInstallEvent = {
  status: PlayInstallStatus;
  bytesDownloaded: number | null;
  totalBytes: number | null;
};
