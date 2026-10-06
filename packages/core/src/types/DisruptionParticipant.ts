import type { Impact } from "src/types/Impact";
import type { ReserveContext } from "src/types/ReserveContext";
import type { ReserveResult } from "src/types/ReserveResult";

/**
 * An application resource that must not be caught by a disruptive command: a
 * document with unsaved edits, an upload in flight. Beacon asks it before every
 * command that can cause an impact it cares about. Left out, `impacts` means
 * every impact that loses what the app holds in memory (`document-replacement`,
 * `javascript-restart`, `native-update-flow`, `worker-takeover` and
 * `external-handoff`, not `may-activate-on-next-start`), so a guard that forgets
 * to narrow itself is asked too. An empty list is refused when the participant
 * registers: list the impacts it cares about, or omit the field. Beacon only
 * orders these steps; the participant owns its own persistence, and nothing
 * here stops work that never asked to be a participant.
 *
 * @example
 * ```ts
 * const participant: DisruptionParticipant = {
 *   name: "drafts",
 *   reserve: () =>
 *     drafts.isDirty()
 *       ? { status: "blocked", code: "unsaved-draft" }
 *       : { status: "reserved" },
 * };
 * ```
 */
export type DisruptionParticipant = {
  name: string;
  impacts?: Impact[] | undefined;
  reserve(context: ReserveContext): ReserveResult;
};
