import type { ReleaseIdentity, RunningReader } from "@priemskiyyy/beacon";

import type { ExpoOptions } from "src/types/ExpoOptions";
import type { UpdatesLike } from "src/types/UpdatesLike";
import { UPDATES_DISABLED } from "src/utils/constants/reasons";
import { createUpdateIdentity } from "src/utils/createUpdateIdentity";

const readIdentity = ({ updateId }: UpdatesLike): ReleaseIdentity => {
  if (updateId === null) {
    return { status: "unknown", reason: UPDATES_DISABLED };
  }

  return createUpdateIdentity(updateId);
};

/**
 * The reader of the running JavaScript bundle, from the `expo-updates`
 * constants: the id of the update that launched, and whether it is the
 * embedded one, an emergency fallback, and which runtime and channel it runs
 * on. Where updates are disabled, as in development, the identity is unknown.
 * `expoUpdates` supplies it for its own route, so pass it in `running.bundle`
 * only to override that, or where no `expoUpdates` route is given: it is made
 * for the `bundle` subject, and the route never writes it.
 *
 * @example
 * ```ts
 * new Beacon({
 *   scope,
 *   // The route supplies this reader itself: passing one is the override.
 *   running: { bundle: expoBundle({ updates: Updates }) },
 *   routes: { ota: expoUpdates({ updates: Updates }) },
 * });
 * ```
 */
export const expoBundle =
  ({ updates }: ExpoOptions): RunningReader<"bundle"> =>
  () => ({
    identity: readIdentity(updates),
    label: null,
    raw: {
      channel: updates.channel,
      runtimeVersion: updates.runtimeVersion,
      embedded: updates.isEmbeddedLaunch,
      emergency: updates.isEmergencyLaunch,
    },
  });
