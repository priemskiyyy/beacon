import type { HttpAnswer } from "src/types/HttpAnswer";
import type { HttpRequest } from "src/types/HttpRequest";

/**
 * Options for `http()`. `request` is the application's own client call: it
 * owns the transport, authentication, retries and, above all, the validation
 * of the response, so what it resolves is trusted as typed. `name` labels the
 * source in diagnostics and evidence. The source keeps and renews an answer
 * only for the scope it was read for, `partition` included, so a validator or
 * a document never crosses from one account to another.
 *
 * @example
 * ```ts
 * http({
 *   name: "release-manifest",
 *   request: async ({ signal, validator }) => parseManifestResponse(await fetchManifest({ signal, validator })),
 * });
 * ```
 */
export type HttpAdapterOptions<TDocument> = {
  name?: string;
  request: (
    request: HttpRequest,
  ) => HttpAnswer<TDocument> | Promise<HttpAnswer<TDocument>>;
};
