import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { useProvidedBeacon } from "./internal/useProvidedBeacon.js";

/**
 * Registers a participant while the component is mounted, and unregisters it
 * on unmount; a provider that publishes a new Beacon moves the registration.
 * The participant is read when Beacon asks, so its closures read the current
 * state and nothing registers again. A reservation the participant already
 * holds stays valid after the component unmounts, as long as the service
 * behind it lives.
 *
 * @example
 * ```ts
 * let dirty = $state(false);
 *
 * useDisruption({
 *   name: "draft-editor",
 *   reserve: () => {
 *     if (dirty) {
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

  // Effects never run on the server, so a server render registers nothing.
  $effect(() => beacon.current.disruptions.register(participant));
};
