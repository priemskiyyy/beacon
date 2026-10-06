import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { createEffect, onCleanup, onMount } from "solid-js";

import { useBeacon } from "src/primitives/useBeacon";

/**
 * Registers a participant on the provider's Beacon while mounted, and
 * unregisters it on unmount. The participant is registered once, so its
 * closures read the current state when Beacon asks, and a change of state never
 * registers again. A reservation the participant already holds stays valid
 * after the owner unmounts, as long as the service behind it lives.
 *
 * @example
 * ```ts
 * const [dirty] = createSignal(false);
 *
 * useDisruption({
 *   name: "draft-editor",
 *   impacts: ["document-replacement"],
 *   reserve: () => (dirty() ? { status: "blocked", code: "unsaved-draft" } : { status: "reserved", release: resume }),
 * });
 * ```
 */
export const useDisruption = (participant: DisruptionParticipant) => {
  const beacon = useBeacon();

  // A provider's Beacon can change, so the registration follows it.
  onMount(() => {
    createEffect(() => {
      onCleanup(beacon().disruptions.register(participant));
    });
  });
};
