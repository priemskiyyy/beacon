import { BeaconError, createReleaseSource } from "@priemskiyyy/beacon";
import type { ReleaseSource } from "@priemskiyyy/beacon";

import type { HttpAdapterOptions } from "src/types/HttpAdapterOptions";
import type { HttpMemory } from "src/types/internal/HttpMemory";
import {
  NOT_MODIFIED_WITHOUT_DOCUMENT,
  UNKNOWN_ANSWER,
} from "src/utils/constants/errors";
import { toSourceRead } from "src/utils/toSourceRead";

/**
 * The application's own release manifest endpoint as a Beacon release source.
 * `fetch` is the application's client call, which validates the response
 * and answers `changed` with the document or `not-modified`; this adapter
 * makes no request and parses nothing. It remembers the last answer it
 * accepted for the scope, so `not-modified` renews that document instead of
 * inventing one, and sends the validator back on the next read. A thrown
 * `BeaconError` keeps its code; any other error fails the read.
 *
 * @example
 * ```ts
 * const manifest = http({
 *   name: "release-manifest",
 *   fetch: ({ signal, validator }) => api.manifest({ signal, etag: validator }),
 * });
 * const web = manifest.select((document) => document.web);
 * ```
 */
export const http = <TDocument>({
  name = "http",
  fetch: fetchAnswer,
}: HttpAdapterOptions<TDocument>): ReleaseSource<TDocument> => {
  let memory: HttpMemory<TDocument> | null = null;

  return createReleaseSource<TDocument>({
    name,
    read: async ({ scope, signal, attempt }) => {
      const held = memory?.scope === scope ? memory : null;

      const answer = await fetchAnswer({
        scope,
        signal,
        attempt,
        validator: held?.validator ?? null,
      });

      if (answer.status === "changed") {
        const read = toSourceRead(answer);

        memory = {
          scope,
          validator: answer.validator ?? null,
          read,
        };

        return read;
      }

      // A client without types can answer anything, and an answer nobody recognizes must not renew what is held.
      if (answer.status !== "not-modified") {
        throw new BeaconError({
          code: "SOURCE_FAILED",
          message: UNKNOWN_ANSWER,
        });
      }

      if (held === null) {
        throw new BeaconError({
          code: "SOURCE_FAILED",
          message: NOT_MODIFIED_WITHOUT_DOCUMENT,
        });
      }

      // Without a new expiry the old one stays, so an answer is never fresher than the backend said.
      const read = {
        ...held.read,
        ...(answer.expiresAt === undefined
          ? {}
          : { expiresAt: answer.expiresAt }),
      };

      memory = { scope, validator: held.validator, read };

      return read;
    },
  });
};
