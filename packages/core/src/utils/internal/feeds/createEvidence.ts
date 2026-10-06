import type { DecisionRevision } from "src/types/DecisionRevision";
import type { Evidence } from "src/types/Evidence";
import type { EvidenceOrigin } from "src/types/EvidenceOrigin";

type EvidenceInput = {
  source: string;
  origin: EvidenceOrigin;
  receivedAt: number;
  expiresAt: number | null;
  issuer: string | null;
  revision: DecisionRevision | null;
};

/** Freshness is read at the instant the evidence is accepted; a timer moves it to `expired` when the time comes. */
export const createEvidence = (input: EvidenceInput): Evidence => {
  const { expiresAt, receivedAt } = input;

  if (expiresAt !== null && expiresAt <= receivedAt) {
    return Object.freeze({ ...input, freshness: "expired" });
  }

  return Object.freeze({ ...input, freshness: "fresh" });
};
