import type { ReleaseScope } from "src/types/ReleaseScope";

/**
 * What a source read is given: the scope it speaks for, a signal that aborts
 * when nobody waits for the answer anymore, and the number of the attempt.
 *
 * @example
 * ```ts
 * const read = async ({ scope, signal }: SourceReadContext) => {
 *   const response = await fetch(`/releases/${scope.environment}.json`, { signal });
 *
 *   return { document: await response.json() };
 * };
 * ```
 */
export type SourceReadContext = {
  scope: ReleaseScope;
  signal: AbortSignal;
  attempt: number;
};
