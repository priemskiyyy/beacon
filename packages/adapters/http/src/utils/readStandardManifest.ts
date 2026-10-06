import type { HttpAnswer } from "src/types/HttpAnswer";
import type { ReadStandardManifestOptions } from "src/types/ReadStandardManifestOptions";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardManifest } from "src/types/StandardManifest";
import { REFUSED_STATUSES } from "src/utils/constants/statuses";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { invalidManifest } from "src/utils/invalidManifest";
import { parseStandardManifest } from "src/utils/parseStandardManifest";
import { readResponseText } from "src/utils/readResponseText";
import { BeaconError } from "@priemskiyyy/beacon";

const isJson = (contentType: string | null) => {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();

  return type === "application/json" || type?.endsWith("+json") === true;
};

/**
 * The answer of an `http` source for the response of a standard manifest
 * endpoint. Only `200` with a JSON body is read, and `304` renews what the
 * source holds. Every other outcome throws, so none is taken for a decision
 * of no release: a login page or an empty body, `204` and `404`, `401` and
 * `403`, `429`, a server error, a redirect, and a body over the size limit
 * each fail the read with a message that names it. The `ETag` becomes the
 * validator for the next read and is never a revision.
 *
 * @example
 * ```ts
 * const manifest = http({
 *   fetch: async ({ scope, signal, validator }) =>
 *     readStandardManifest({
 *       response: await fetch("/releases.json", {
 *         signal,
 *         headers: validator === null ? {} : { "if-none-match": validator },
 *       }),
 *       scope,
 *       routes: { web: { kind: "target" } },
 *       now: Date.now(),
 *     }),
 * });
 * ```
 */
export const readStandardManifest = async <
  TDeclarations extends RouteDeclarations,
>({
  response,
  scope,
  routes,
  now,
  limits,
}: ReadStandardManifestOptions<TDeclarations>): Promise<
  HttpAnswer<StandardManifest<TDeclarations>>
> => {
  if (response.status === 304) {
    return { status: "not-modified" };
  }

  if (response.status !== 200) {
    throw new BeaconError({
      code: "SOURCE_FAILED",
      message: `The manifest endpoint ${REFUSED_STATUSES.get(response.status) ?? `answered ${response.status}`}.`,
    });
  }

  if (response.redirected === true) {
    throw new BeaconError({
      code: "SOURCE_FAILED",
      message: "The manifest endpoint redirected, which this reader refuses.",
    });
  }

  if (!isJson(response.headers.get("content-type"))) {
    throw invalidManifest("The manifest is not a JSON response.");
  }

  const bounds = { ...DEFAULT_LIMITS, ...limits };
  const text = await readResponseText(response, bounds.bytes);

  const read = parseStandardManifest({
    text,
    scope,
    routes,
    now,
    limits: bounds,
  });

  const validator = response.headers.get("etag");

  if (validator === null) {
    return { status: "changed", ...read };
  }

  return { status: "changed", validator, ...read };
};
