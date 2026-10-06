/** How a flexible flow ended: downloaded, declined at the consent step, failed, or left unknown because the session ended first. */
export type DownloadResult =
  | { status: "downloaded" }
  | { status: "cancelled"; stage: string }
  | { status: "failed" }
  | { status: "session-ended" };
