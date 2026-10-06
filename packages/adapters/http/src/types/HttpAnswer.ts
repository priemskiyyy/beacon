import type { SourceRead } from "@priemskiyyy/beacon/adapter";

/**
 * What the application's client resolves for one read, already validated by
 * the client. A `document` is a changed answer, so `status` is left out, or
 * written as `changed`: it carries the document and the evidence Beacon
 * judges it by, plus the validator to send next time. `not-modified` renews
 * the document this source holds and claims nothing about it, with the new
 * expiry when the backend gave one; without it, the renewal keeps the old
 * expiry, so freshness is never assumed, unless the answer it renews says it
 * `holdsFor` a window: a backend that claimed no expiry is confirming the
 * document now, so the window starts again from the confirmation.
 *
 * @example
 * ```ts
 * const answer: HttpAnswer<Manifest> = {
 *   document: manifest,
 *   validator: '"208"',
 *   revision: { kind: "ordered", domain: "notes-web", epoch: "v1", value: "208" },
 * };
 * const unchanged: HttpAnswer<Manifest> = { status: "not-modified" };
 * ```
 */
export type HttpAnswer<TDocument> =
  | ({
      status?: "changed";
      validator?: string;
      /** The milliseconds the answer holds for when its backend claimed no expiry, which `expiresAt` counts once and a `not-modified` counts again. */
      holdsFor?: number;
    } & SourceRead<TDocument>)
  | { status: "not-modified"; expiresAt?: number };
