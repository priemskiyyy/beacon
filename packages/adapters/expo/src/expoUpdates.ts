import { createReleaseDriver } from "@priemskiyyy/beacon";
import type { CommandMap, ProviderResult } from "@priemskiyyy/beacon";

import type { ExpoBody } from "src/types/ExpoBody";
import type { ExpoDownloadReceipt } from "src/types/ExpoDownloadReceipt";
import type { ExpoNative } from "src/types/ExpoNative";
import type { ExpoOptions } from "src/types/ExpoOptions";
import type { ExpoReloadReceipt } from "src/types/ExpoReloadReceipt";
import { UPDATES_DISABLED } from "src/utils/constants/reasons";
import { mapCheckResult } from "src/utils/mapCheckResult";
import { prepareFetchResult } from "src/utils/prepareFetchResult";
import { bindReporter, getReporter } from "src/utils/reporters";

const commands = {
  download: {
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "provider-current",
    run: async ({
      native,
      offer,
    }): Promise<ProviderResult<ExpoDownloadReceipt>> => {
      if (!native.updates.isEnabled) {
        return { status: "unsupported", reason: UPDATES_DISABLED };
      }

      const { prepared, receipt } = prepareFetchResult(
        await native.updates.fetchUpdateAsync(),
        offer.release.identity,
      );

      // A result that prepared nothing new leaves what was known as it was.
      if (prepared !== null) {
        getReporter(native)?.prepared(prepared);
      }

      return { status: "accepted", receipt };
    },
  },
  reload: {
    reference: "prepared",
    impacts: ["javascript-restart"],
    binding: "provider-current",
    run: async ({ native }): Promise<ProviderResult<ExpoReloadReceipt>> => {
      if (!native.updates.isEnabled) {
        return { status: "unsupported", reason: UPDATES_DISABLED };
      }

      await native.updates.reloadAsync();

      return { status: "accepted", receipt: { kind: "reload-requested" } };
    },
  },
} satisfies CommandMap<ExpoNative, ExpoBody, ExpoBody>;

/**
 * Expo Updates as a Beacon route. Discovery, eligibility, asset fetching,
 * verification and startup selection stay with `expo-updates`: a check maps
 * its whole result, a rollback to the embedded update is an offer of its own,
 * and a rejection or disabled updates are never reported as no update.
 * `download` asks the provider for its current selection, which may differ
 * from the offer, and says how; it may also be selected on a later start, so
 * it declares that before the user agrees. The module belongs to one open
 * session at a time: a second Beacon that opens a route on it fails to open
 * it, as `DRIVER_FAILED`. `reload` restarts the
 * JavaScript runtime and guarantees no code after it. Autonomous native
 * startup checks are not observed, and no configuration is ever changed.
 *
 * @example
 * ```ts
 * import * as Updates from "expo-updates";
 *
 * const routes = { ota: expoUpdates({ updates: Updates }) };
 * ```
 */
export const expoUpdates = ({ updates }: ExpoOptions) =>
  createReleaseDriver<ExpoNative, ExpoBody, ExpoBody, typeof commands>({
    name: "expo-updates",
    subject: "bundle",
    prepares: true,
    exclusive: updates,
    open: ({ emit }) => {
      const native: ExpoNative = { updates };

      return {
        native,
        check: async () => {
          if (!updates.isEnabled) {
            return { status: "unknown", reason: "unsupported-environment" };
          }

          return mapCheckResult(await updates.checkForUpdateAsync());
        },
        dispose: bindReporter(native, emit),
      };
    },
    commands,
  });
