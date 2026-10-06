import type { CommandOutcome } from "@priemskiyyy/beacon";

import type { ExpoDownloadReceipt } from "src/types/ExpoDownloadReceipt";
import type { ExpoReloadReceipt } from "src/types/ExpoReloadReceipt";

/**
 * Where `applyUpdate` stopped, and how the command it stopped at settled.
 * `none` is no command: nothing was on offer and nothing was prepared.
 * `download` stopped at the download: it was refused, failed or was blocked,
 * or it was accepted and prepared nothing to reload, which its receipt
 * (`no-new-preparation`) says. `reload` ran the restart, whatever its outcome,
 * and carries the accepted download that came before it, whose receipt says
 * whether what was prepared is what was offered, or `null` when an update
 * downloaded earlier was reloaded without a download. An accepted reload
 * proves no update runs: only the next boot does.
 *
 * @example
 * ```ts
 * const applied = await applyUpdate(beacon.route("ota"));
 *
 * if (applied.step === "reload" && applied.outcome.status === "blocked") {
 *   console.info(applied.outcome.reasons.map((reason) => reason.code));
 * }
 * ```
 */
export type AppliedUpdate =
  | { step: "none" }
  | { step: "download"; outcome: CommandOutcome<ExpoDownloadReceipt> }
  | {
      step: "reload";
      outcome: CommandOutcome<ExpoReloadReceipt>;
      download: Extract<
        CommandOutcome<ExpoDownloadReceipt>,
        { status: "accepted" }
      > | null;
    };
