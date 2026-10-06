/**
 * What an accepted download proves, and no more: the package was downloaded,
 * installed for the next start, and CodePush then listed it as pending. It is
 * staged, never running, and it may be picked up at a start nobody asked for.
 * The name is not `installed`, which CodePush uses for this state and a reader
 * hears as running.
 *
 * @example
 * ```ts
 * const receipt: CodePushDownloadReceipt = { kind: "update-staged", update: { hash: "9f2c", label: "v12" } };
 * ```
 */
export type CodePushDownloadReceipt = {
  kind: "update-staged";
  update: { hash: string; label: string | null };
};
