import type { Settlement } from "src/types/Settlement";

/**
 * A participant's answer to a reservation. `blocked` refuses the command at
 * once, with a code for the application's own presentation. `reserved` closes
 * the participant's admission of new work, synchronously, before `settle`
 * waits for the work already begun, such as a save in flight. `resume` reopens
 * admission, runs whether the command went on or not, and is left out when
 * there is nothing to reopen.
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
 *   resume: () => drafts.resume(),
 * };
 * ```
 */
export type ReserveResult =
  | { status: "blocked"; code: string }
  | {
      status: "reserved";
      settle?: (context: { signal: AbortSignal }) => Promise<Settlement>;
      resume?: () => void;
    };
