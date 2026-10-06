import type { ReleaseScope } from "@priemskiyyy/beacon";

/**
 * What one read hands the application's client: the scope the answer must
 * speak for, the signal that aborts once nobody waits for it, the number of
 * the attempt, and the validator of the answer this source holds for that
 * scope. Send the validator as `If-None-Match` to let the backend answer that
 * nothing changed.
 *
 * @example
 * ```ts
 * const getManifest = ({ scope, signal, validator }: HttpFetchContext) =>
 *   api.manifest({ scope, signal, etag: validator });
 * ```
 */
export type HttpFetchContext = {
  scope: ReleaseScope;
  signal: AbortSignal;
  attempt: number;
  validator: string | null;
};
