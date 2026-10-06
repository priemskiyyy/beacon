import { createReleaseDriver } from "@priemskiyyy/beacon";
import type {
  CommandMap,
  ObservationDraft,
  ProviderResult,
} from "@priemskiyyy/beacon";

import { expoBundle } from "src/expoBundle";
import type { ExpoBody } from "src/types/ExpoBody";
import type { ExpoDownloadReceipt } from "src/types/ExpoDownloadReceipt";
import type { ExpoNative } from "src/types/ExpoNative";
import type { ExpoOptions } from "src/types/ExpoOptions";
import type { ExpoReloadReceipt } from "src/types/ExpoReloadReceipt";
import { askUpdates } from "src/utils/askUpdates";
import { UPDATES_DISABLED } from "src/utils/constants/reasons";
import { emitters } from "src/utils/emitters";
import { readCheckResult } from "src/utils/readCheckResult";
import { readFetchResult } from "src/utils/readFetchResult";

const commands = {
  download: {
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "provider-current",
    run: async (context): Promise<ProviderResult<ExpoDownloadReceipt>> => {
      const { native, offer } = context;

      if (!native.updates.isEnabled) {
        return { status: "unsupported", reason: UPDATES_DISABLED };
      }

      const fetched = await askUpdates(() => native.updates.fetchUpdateAsync());

      if (fetched.status === "refused") {
        return { status: "unsupported", reason: UPDATES_DISABLED };
      }

      const { prepared, receipt } = readFetchResult(
        fetched.value,
        offer.release.identity,
      );

      // A result that prepared nothing new leaves what was known as it was.
      if (prepared !== null) {
        emitters.get(native)?.prepared(prepared);
      }

      return { status: "accepted", receipt };
    },
  },
  reload: {
    reference: "prepared",
    impacts: ["javascript-restart"],
    binding: "provider-current",
    run: async (context): Promise<ProviderResult<ExpoReloadReceipt>> => {
      const { native } = context;

      if (!native.updates.isEnabled) {
        return { status: "unsupported", reason: UPDATES_DISABLED };
      }

      const reloaded = await askUpdates(() => native.updates.reloadAsync());

      if (reloaded.status === "refused") {
        return { status: "unsupported", reason: UPDATES_DISABLED };
      }

      return { status: "accepted", receipt: { kind: "reload-requested" } };
    },
  },
} satisfies CommandMap<ExpoNative, ExpoBody, ExpoBody>;

/**
 * Expo Updates as a Beacon route. Discovery, eligibility, asset fetching,
 * verification and startup selection stay with `expo-updates`: a check maps
 * its whole result, a rollback to the embedded update is an offer of its own,
 * and a rejection or disabled updates are never reported as no update. A
 * development client reports updates enabled and then refuses each call with
 * `ERR_NOT_AVAILABLE_IN_DEV_CLIENT`, and a debug build with
 * `ERR_UPDATES_DISABLED`: both are an environment that cannot update, like
 * disabled updates. `download` asks the provider for its current selection,
 * which may differ from the offer, and says how; it may also be selected on a
 * later start, so it declares that before the user agrees. The module belongs
 * to one open session at a time: a second Beacon that opens a route on it
 * fails to open it, as `DRIVER_FAILED`. `reload` restarts the JavaScript
 * runtime and guarantees no code after it. The route reads the running bundle
 * too, from the same module (`expoBundle`), so the journal knows which update
 * a reload reached with no `running.bundle`; a reader the application passes
 * for the bundle wins. Autonomous native startup checks are not observed, and
 * no configuration is ever changed.
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
    running: expoBundle({ updates }),
    prepares: true,
    exclusive: updates,
    open: ({ emit }) => {
      const native: ExpoNative = { updates };

      emitters.set(native, emit);

      return {
        native,
        check: async (): Promise<ObservationDraft<ExpoBody>> => {
          const unsupported = {
            status: "unknown",
            reason: "unsupported-environment",
          } satisfies ObservationDraft<ExpoBody>;

          if (!updates.isEnabled) {
            return unsupported;
          }

          const checked = await askUpdates(() => updates.checkForUpdateAsync());

          if (checked.status === "refused") {
            return unsupported;
          }

          return readCheckResult(checked.value);
        },
        dispose: () => {
          emitters.delete(native);
        },
      };
    },
    commands,
  });
