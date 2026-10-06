import type { DecisionRevision } from "src/types/DecisionRevision";
import type { EvidenceOrigin } from "src/types/EvidenceOrigin";

/**
 * What backs an accepted observation: which source it came from, how it
 * arrived, when Beacon accepted it and until when it holds. It goes stale by
 * time, never by a failed check: a failure leaves the last accepted
 * observation and its evidence in place.
 *
 * @example
 * ```ts
 * const { evidence } = beacon.route("web").state.get().observation;
 * ```
 */
export type Evidence = {
  /** The name of the source or provider that produced it. */
  source: string;
  origin: EvidenceOrigin;
  /** Epoch milliseconds when Beacon accepted it. */
  receivedAt: number;
  /** Epoch milliseconds when it stops holding, or `null` when it never does. */
  expiresAt: number | null;
  freshness: "fresh" | "expired";
  issuer: string | null;
  revision: DecisionRevision | null;
};
