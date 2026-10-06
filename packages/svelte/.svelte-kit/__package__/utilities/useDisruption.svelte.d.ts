import type { DisruptionParticipant } from "@priemskiyyy/beacon";
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
 *   impacts: ["document-replacement"],
 *   reserve: () => (dirty ? { status: "blocked", code: "unsaved-draft" } : { status: "reserved", release: resume }),
 * });
 * ```
 */
export declare const useDisruption: (participant: DisruptionParticipant) => void;
