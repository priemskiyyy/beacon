import { BeaconError, createReleaseSource } from "@priemskiyyy/beacon";
import type {
  ReleaseScope,
  ReleaseSource,
  SourceRead,
} from "@priemskiyyy/beacon";

import type { HttpAdapterOptions } from "src/types/HttpAdapterOptions";
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
 * const manifest = http<Manifest>({
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
  // The last answer accepted and the scope it speaks for. The scope is matched by identity, since Beacon hands over the same frozen scope for as long as it is in force: a copy is another scope and finds nothing held, which costs one unconditional read and never shares an account's answer.
  let memory: {
    scope: ReleaseScope;
    validator: string | null;
    read: SourceRead<TDocument>;
  } | null = null;

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
          message: "The client answered neither changed nor not modified.",
        });
      }

      if (held === null) {
        throw new BeaconError({
          code: "SOURCE_FAILED",
          message:
            "The backend answered not modified, but this source holds no document to renew.",
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
