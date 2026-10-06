import type { SourceRead } from "@priemskiyyy/beacon";

/**
 * What the application's client resolves for one read, already validated by
 * the client. `changed` carries the document and the evidence Beacon judges
 * it by, plus the validator to send next time. `not-modified` renews the
 * document this source holds and claims nothing about it, with the new expiry
 * when the backend gave one; without it, the renewal keeps the old expiry, so
 * freshness is never assumed.
 *
 * @example
 * ```ts
 * const answer: HttpAnswer<Manifest> = {
 *   status: "changed",
 *   document: manifest,
 *   validator: '"208"',
 *   revision: { kind: "ordered", domain: "notes-web", epoch: "v1", value: "208" },
 * };
 * ```
 */
export type HttpAnswer<TDocument> =
  | ({ status: "changed"; validator?: string } & SourceRead<TDocument>)
  | { status: "not-modified"; expiresAt?: number };
