import { createReleaseDriver } from "@priemskiyyy/beacon";
import type { CommandMap, ProviderResult } from "@priemskiyyy/beacon";

import type { CodePushDownloadReceipt } from "src/types/CodePushDownloadReceipt";
import type { CodePushNative } from "src/types/CodePushNative";
import type { CodePushOffer } from "src/types/CodePushOffer";
import type { CodePushOptions } from "src/types/CodePushOptions";
import type { CodePushPrepared } from "src/types/CodePushPrepared";
import type { CodePushReloadReceipt } from "src/types/CodePushReloadReceipt";
import { CodePushSession } from "src/utils/CodePushSession";

const commands = {
  download: {
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "exact-instance",
    run: async (context): Promise<ProviderResult<CodePushDownloadReceipt>> => {
      const { native, offer, signal } = context;

      return CodePushSession.of(native).download(offer, signal);
    },
  },
  reload: {
    reference: "prepared",
    impacts: ["javascript-restart"],
    binding: "provider-current",
    run: async (context): Promise<ProviderResult<CodePushReloadReceipt>> => {
      const { native, prepared, signal } = context;

      return CodePushSession.of(native).reload(prepared, signal);
    },
  },
} satisfies CommandMap<CodePushNative, CodePushOffer, CodePushPrepared>;

/**
 * The React Native CodePush family as a Beacon route: Microsoft's
 * `react-native-code-push` and the forks `@revopush/react-native-code-push`,
 * `@bravemobile/react-native-code-push` and `@appzung/react-native-code-push`.
 * A package CodePush hands over is an offer named by the hash of its release,
 * and `null` is no offer with the detail `no-package-for-binary`, never "up to
 * date": CodePush answers it for no update, for one that needs a newer binary,
 * for the hashes the device and the binary hold, and in some forks for a
 * failure it swallowed. `download` downloads that package and
 * installs it for the next start, and is accepted once CodePush lists it as
 * pending; it may also be picked up at a start nobody asked for, so it declares
 * that before the user agrees. `reload` asks CodePush to restart for it, and
 * proves no restart. The adapter never calls `sync`, `notifyAppReady` or
 * `allowRestart`, never installs immediately and configures nothing: the app's
 * own `CodePush({ checkFrequency: MANUAL })` decorator is what stops the
 * library from checking and installing by itself, and calling
 * `notifyAppReady()` is the app's too. The module belongs to one open session
 * at a time: a second Beacon that opens a route on it fails to open it, as
 * `DRIVER_FAILED`.
 *
 * @example
 * ```ts
 * import CodePush from "react-native-code-push";
 *
 * const routes = { update: codePushUpdates({ codePush: CodePush }) };
 * ```
 */
export const codePushUpdates = ({ codePush }: CodePushOptions) =>
  createReleaseDriver<
    CodePushNative,
    CodePushOffer,
    CodePushPrepared,
    typeof commands
  >({
    name: "code-push",
    subject: "bundle",
    prepares: true,
    exclusive: codePush,
    open: ({ emit }) => {
      const native: CodePushNative = { codePush };
      const session = new CodePushSession({ native, emit });

      return {
        native,
        check: session.check,
        reconcile: session.reconcile,
        dispose: session.dispose,
      };
    },
    commands,
  });
