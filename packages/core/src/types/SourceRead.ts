import type { DecisionRevision } from "src/types/DecisionRevision";

/**
 * What a source answers: an already validated document, and what Beacon needs
 * to judge it. A source that cannot answer rejects instead, and no answer
 * ever means "no release". `digest` fingerprints the decision without its
 * renewable envelope, so a renewal is told from a conflict.
 *
 * @example
 * ```ts
 * const answer: SourceRead<Manifest> = {
 *   document: manifest,
 *   revision: { kind: "ordered", domain: "notes-web", epoch: "v1", value: "208" },
 *   digest: "9f2c",
 *   expiresAt: Date.parse(manifest.expiresAt),
 * };
 * ```
 */
export type SourceRead<TDocument> = {
  document: TDocument;
  revision?: DecisionRevision;
  digest?: string;
  issuer?: string;
  /** Epoch milliseconds when the answer stops holding, the narrowest of every limit that applies. */
  expiresAt?: number;
};
