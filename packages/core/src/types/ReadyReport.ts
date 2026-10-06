/**
 * What `reportReady` answers: whether this checkpoint was new in this boot.
 * Reporting it again is harmless.
 *
 * @example
 * ```ts
 * const report: ReadyReport = { status: "recorded", checkpoint: "primary-screen" };
 * ```
 */
export type ReadyReport = {
  status: "recorded" | "already-recorded";
  checkpoint: string;
};
