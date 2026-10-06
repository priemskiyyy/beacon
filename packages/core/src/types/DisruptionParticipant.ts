import type { Impact } from "src/types/Impact";
import type { ReserveContext } from "src/types/ReserveContext";
import type { ReserveResult } from "src/types/ReserveResult";

/**
 * An application resource that must not be caught by a disruptive command: a
 * document with unsaved edits, an upload in flight. It names the impacts it
 * cares about, and Beacon asks it before every command that can cause one.
 * Beacon only orders these steps; the participant owns its own persistence,
 * and nothing here stops work that never asked to be a participant.
 *
 * @example
 * ```ts
 * const participant: DisruptionParticipant = {
 *   name: "drafts",
 *   impacts: ["document-replacement", "javascript-restart"],
 *   reserve: () => ({ status: "reserved", release: drafts.resume }),
 * };
 * ```
 */
export type DisruptionParticipant = {
  name: string;
  impacts: Impact[];
  reserve(context: ReserveContext): ReserveResult;
};
