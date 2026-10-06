/**
 * What an accepted download proves, and no more. `offered` relates what the
 * provider prepared to what the user was shown: the provider fetches its own
 * current selection, not the checked update, so it can differ.
 * `no-new-preparation` is a valid answer that prepared nothing new: it is not
 * a prepared update.
 *
 * @example
 * ```ts
 * const receipt: ExpoDownloadReceipt = { kind: "no-new-preparation" };
 * ```
 */
export type ExpoDownloadReceipt =
  | {
      kind: "update-prepared";
      update: { id: string };
      offered: "same" | "different" | "unknown";
    }
  | { kind: "rollback-prepared"; offered: "same" | "different" | "unknown" }
  | { kind: "no-new-preparation" };
