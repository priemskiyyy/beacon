import type { DisruptionParticipant } from "src/types/DisruptionParticipant";

/**
 * Where an application registers what a disruptive command must not catch.
 * Registering from deep in a component tree is fine; the participant must
 * outlive any reservation it holds, even when its view unmounts.
 *
 * @example
 * ```ts
 * const unregister = beacon.disruptions.register(participant);
 * ```
 */
export type Disruptions = {
  register: (participant: DisruptionParticipant) => () => void;
};
