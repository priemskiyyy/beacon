import type { RunningRelease } from "@priemskiyyy/beacon";

import type { CodePushLike } from "src/types/CodePushLike";
import { EMBEDDED_IDENTITY } from "src/utils/constants/identities";
import { createPackageIdentity } from "src/utils/createPackageIdentity";
import { readLabel } from "src/utils/readLabel";

/**
 * The reader of the running JavaScript bundle, from the package CodePush says
 * runs. `null` is the bundle inside the binary, which CodePush does not name,
 * so its identity is unknown with the reason `embedded-bundle`, and so is a
 * package the forks flag as only on disk while the binary's own bundle runs.
 * A package is named by its hash, in the words the route uses, so a journal
 * compares what a reload asked for with what runs. Pass it as the `bundle`
 * reader; the route never writes it.
 *
 * @example
 * ```ts
 * import CodePush from "react-native-code-push";
 *
 * new Beacon({
 *   scope,
 *   running: { boot: { id: BOOT_ID }, bundle: codePushBundle(CodePush) },
 *   routes: { update: codePushUpdates({ codePush: CodePush }) },
 * });
 * ```
 */
export const codePushBundle =
  (codePush: CodePushLike) => async (): Promise<RunningRelease> => {
    const running = await codePush.getUpdateMetadata(
      codePush.UpdateState.RUNNING,
    );

    // The forks set it where an update sits on disk and the binary's own bundle is what runs.
    if (running === null || running._isDebugOnly === true) {
      return {
        identity: EMBEDDED_IDENTITY,
        label: null,
        raw: { label: null, embedded: true },
      };
    }

    const label = readLabel(running.label);

    return {
      identity: createPackageIdentity(running.packageHash),
      label,
      raw: { label, embedded: false },
    };
  };
