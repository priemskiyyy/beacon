import type { HttpAnswer } from "src/types/HttpAnswer";
import type { HttpRequest } from "src/types/HttpRequest";

/**
 * Options for `http()`. `request` is the application's own client call: it
 * owns the transport, authentication, retries and, above all, the validation
 * of the response, so what it resolves is trusted as typed. `name` labels the
 * source in diagnostics and evidence.
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
