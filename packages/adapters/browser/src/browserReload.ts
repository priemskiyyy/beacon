import { createUpdateMechanism } from "@priemskiyyy/beacon";
import type { ProviderResult } from "@priemskiyyy/beacon";

import type { BrowserReloadOptions } from "src/types/BrowserReloadOptions";
import type { BrowserReloadReceipt } from "src/types/BrowserReloadReceipt";
import { NO_DOCUMENT } from "src/utils/constants/reasons";
import { getWindow } from "src/utils/getWindow";

/**
 * Reloading the browser document as a Beacon update mechanism. Its one
 * command, `reload`, needs the offer the user was shown, replaces the
 * document, and is bound to nothing: the next navigation receives whatever is
 * deployed, which may be another build than the offer. Accepting means the
 * reload was requested; only the next boot can show what runs. Without a
 * window, such as in a server render, opening does nothing, `native.window` is
 * `null` and the command is unsupported.
 *
 * @example
 * ```ts
 * const web = targetRoute({
 *   subject: "web",
 *   source: manifest.select((document) => document.web),
 *   mechanism: browserReload(),
 * });
 * ```
 */
export const browserReload = ({ target }: BrowserReloadOptions = {}) =>
  createUpdateMechanism({
    name: "browser-reload",
    open: () => ({ native: { window: target ?? getWindow() } }),
    commands: {
      reload: {
        reference: "offer",
        impacts: ["document-replacement"],
        binding: "unpinned-navigation",
        run: async ({
          native,
        }): Promise<ProviderResult<BrowserReloadReceipt>> => {
          if (native.window === null) {
            return { status: "unsupported", reason: NO_DOCUMENT };
          }

          native.window.location.reload();

          return { status: "accepted", receipt: { kind: "reload-requested" } };
        },
      },
    },
  });
