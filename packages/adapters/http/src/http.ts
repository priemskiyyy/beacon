import { BeaconError, createReleaseSource } from "@priemskiyyy/beacon";
import type { ReleaseSource } from "@priemskiyyy/beacon";

import type { HttpAdapterOptions } from "src/types/HttpAdapterOptions";
import type { HttpMemory } from "src/types/HttpMemory";
import { NOT_MODIFIED_WITHOUT_DOCUMENT } from "src/utils/constants/errors";
import { renewRead } from "src/utils/renewRead";
import { toSourceRead } from "src/utils/toSourceRead";

/**
 * The application's own release manifest endpoint as a Beacon release source.
 * `request` is the application's client call, which validates the response
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
 *   request: ({ signal, validator }) => api.manifest({ signal, etag: validator }),
 * });
 * const web = manifest.select((document) => document.web);
 * ```
 */
export const http = <TDocument>({
  name = "http",
  partition,
  request,
}: HttpAdapterOptions<TDocument>): ReleaseSource<TDocument> => {
  let memory: HttpMemory<TDocument> | null = null;

  return createReleaseSource<TDocument>({
    name,
    read: async ({ scope, signal, attempt }) => {
      const owner = partition?.() ?? null;

      const held =
        memory?.scope === scope && memory.partition === owner ? memory : null;

      const answer = await request({
        scope,
        signal,
        attempt,
        validator: held?.validator ?? null,
      });

      if (answer.status === "changed") {
        const read = toSourceRead(answer);

        memory = {
          scope,
          partition: owner,
          validator: answer.validator ?? null,
          read,
        };

        return read;
      }

      if (held === null) {
        throw new BeaconError({
          code: "SOURCE_FAILED",
          message: NOT_MODIFIED_WITHOUT_DOCUMENT,
        });
      }

      const read = renewRead(held.read, answer.expiresAt);

      memory = { scope, partition: owner, validator: held.validator, read };

      return read;
    },
  });
};
