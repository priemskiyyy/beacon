import type { Settlement } from "src/types/Settlement";

/**
 * A participant's answer to a reservation. `blocked` refuses the command at
 * once, with a code for the application's own presentation. `reserved` closes
 * the participant's admission of new work, synchronously, before `settle`
 * waits for the work already begun, such as a save in flight. `release`
 * reopens admission and runs whether the command went on or not.
 *
 * @example
 * ```ts
 * const reserved: ReserveResult = {
 *   status: "reserved",
 *   settle: async ({ signal }) => {
 *     await drafts.flush({ signal });
 *
 *     return { status: "ready" };
 *   },
 *   release: () => lease.release(),
 * };
 * ```
 */
export type ReserveResult =
  | { status: "blocked"; code: string }
  | {
      status: "reserved";
      settle?: (context: { signal: AbortSignal }) => Promise<Settlement>;
      release: () => void;
    };
