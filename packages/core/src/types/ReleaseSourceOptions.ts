import type { SourceRead } from "src/types/SourceRead";
import type { SourceReadContext } from "src/types/SourceReadContext";

/**
 * A custom backend as a source: a name for diagnostics and a `read` that
 * answers a validated document or rejects. Nothing infers a document from an
 * unvalidated response, so `read` runs your parser before it answers.
 *
 * @example
 * ```ts
 * const options: ReleaseSourceOptions<Decision> = {
 *   name: "internal-release-api",
 *   read: async ({ scope, signal }) => ({
 *     document: parseDecision(await api.getDecision({ scope, signal })),
 *   }),
 * };
 * ```
 */
export type ReleaseSourceOptions<TDocument> = {
  name: string;
  read: (context: SourceReadContext) => Promise<SourceRead<TDocument>>;
};
