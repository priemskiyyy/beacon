import type { Reconciliation } from "src/types/Reconciliation";

/**
 * What the journal knows. `journal` says whether it is `off`, being `read`,
 * `ready`, or `degraded` because a read or a write failed, which narrows what
 * can be correlated across boots. `latest` is the most recent intent and what
 * the running facts say about it, `dropped` counts the older intents the
 * journal let go of because its capacity or their retention ran out, which
 * makes that coverage visibly gone, and `checkpoints` are the readiness
 * checkpoints the application reported in this boot. A target that runs
 * without a reported checkpoint has unknown readiness, neither failed nor
 * succeeded.
 *
 * @example
 * ```ts
 * const { journal, latest, checkpoints } = beacon.transitions.get();
 * ```
 */
export type TransitionState = {
  /** Grows with every meaningful change of this snapshot. */
  revision: number;
  journal: "off" | "reading" | "ready" | "degraded";
  latest: Reconciliation | null;
  dropped: number;
  checkpoints: string[];
};
