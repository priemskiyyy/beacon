import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { onMounted, onWatcherCleanup, watch } from "vue";

import { useProvidedBeacon } from "src/composables/internal/useProvidedBeacon";

/**
 * Registers a participant while the component is mounted, and unregisters it
 * on unmount. It registers once, so its closures read reactive state when
 * Beacon asks, and a provider whose `beacon` changes gets it instead. A
 * reservation the participant already holds stays valid after the component
 * unmounts, as long as the service behind it lives.
 *
 * @example
 * ```ts
 * const dirty = ref(false);
 *
 * useDisruption({
 *   name: "draft-editor",
 *   reserve: () => {
 *     if (dirty.value) {
 *       return { status: "blocked", code: "unsaved-draft" };
 *     }
 *
 *     return { status: "reserved" };
 *   },
 * });
 * ```
 */
export const useDisruption = (participant: DisruptionParticipant) => {
  const beacon = useProvidedBeacon("useDisruption");

  onMounted(() => {
    watch(
      () => beacon.value.disruptions,
      (disruptions) => {
        onWatcherCleanup(disruptions.register(participant));
      },
      { immediate: true, flush: "sync" },
    );
  });
};
