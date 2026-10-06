import type { RouteHandle } from "@priemskiyyy/beacon";

import type { AppliedUpdate } from "src/types/AppliedUpdate";
import type { ExpoRoute } from "src/types/ExpoRoute";
import { reloadPrepared } from "src/utils/reloadPrepared";

/**
 * Applies the update a route has: downloads what is on offer, then reloads
 * what is prepared, and answers where it stopped and how that command settled.
 * It is the two commands of the route in their order and nothing more, so a
 * participant still guards the reload, the journal still records it and a
 * command that is blocked, refused or failed is its outcome, never a throw.
 * The download may prepare another update than the one offered: its receipt,
 * given with the reload, says so. With nothing on offer it reloads an update
 * that was downloaded earlier, and with neither it asks the SDK for nothing.
 * An accepted reload is a request: the route stays unresolved until
 * `route.acknowledge()`, and only the next boot shows which update runs.
 *
 * @example
 * ```ts
 * const applied = await applyUpdate(beacon.route("ota"));
 *
 * if (applied.step === "download" && applied.outcome.status === "failed") {
 *   console.warn(applied.outcome.error.message);
 * }
 * ```
 */
export const applyUpdate = async <TName extends string>(
  route: RouteHandle<TName, ExpoRoute>,
): Promise<AppliedUpdate> => {
  const { observation } = route.state.get();

  if (observation.status !== "available") {
    return reloadPrepared(route, null);
  }

  const download = await route.download({ offer: observation.offer.ref });

  if (download.status !== "accepted") {
    return { step: "download", outcome: download };
  }

  const reloaded = await reloadPrepared(route, download);

  // The download prepared nothing to reload: its receipt says so.
  if (reloaded.step === "none") {
    return { step: "download", outcome: download };
  }

  return reloaded;
};
