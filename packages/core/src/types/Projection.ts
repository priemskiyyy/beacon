import type { ReleaseSource } from "src/types/ReleaseSource";

/**
 * One typed view of a source's document. Every projection of a source shares
 * its one read and its one accepted document, so a route and a policy never
 * see two different revisions. `project` is pure and synchronous.
 *
 * @example
 * ```ts
 * const webDecision = manifest.select((document) => document.routes.web);
 * ```
 */
export type Projection<TDocument, TSelected> = {
  source: ReleaseSource<TDocument>;
  project(document: TDocument): TSelected;
};
