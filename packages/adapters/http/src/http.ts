import { BeaconError } from "@priemskiyyy/beacon";
import { createReleaseSource } from "@priemskiyyy/beacon/adapter";
import type { ReleaseScope, ReleaseSource } from "@priemskiyyy/beacon";
import type { SourceRead } from "@priemskiyyy/beacon/adapter";

import type { HttpOptions } from "src/types/HttpOptions";
import { toSourceRead } from "src/utils/toSourceRead";

/**
 * The application's own release manifest endpoint as a Beacon release source.
 * `fetch` is the application's client call, which validates the response
 * and answers the document, or `not-modified`; this adapter makes no request
 * and parses nothing. For a manifest at a URL, `standardManifestSource` makes
 * the request and the parse for you. It remembers the last answer it
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
}: HttpOptions<TDocument>): ReleaseSource<TDocument> => {
  // The last answer accepted and the scope it speaks for. The scope is matched by identity, since Beacon hands over the same frozen scope for as long as it is in force: a copy is another scope and finds nothing held, which costs one unconditional read and never shares an account's answer.
  let memory: {
    scope: ReleaseScope;
    validator: string | null;
    read: SourceRead<TDocument>;
    // What the answer holds for when its backend claimed no expiry, which a not modified counts again from its own time.
    holdsFor: number | null;
  } | null = null;

  return createReleaseSource<TDocument>({
    name,
    read: async (context) => {
      const { scope, signal, attempt, clock } = context;
      const held = memory?.scope === scope ? memory : null;

      const answer = await fetchAnswer({
        scope,
        signal,
        attempt,
        clock,
        validator: held?.validator ?? null,
      });

      if (answer.status === undefined || answer.status === "changed") {
        const read = toSourceRead(answer);

        memory = {
          scope,
          validator: answer.validator ?? null,
          read,
          holdsFor: answer.holdsFor ?? null,
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

      // Without a new expiry the old one stays, so an answer is never fresher than the backend said. The exception is an answer that claimed none: its window is the client's, and the backend confirming it now starts the window again.
      const confirmedFor =
        held.holdsFor === null ? undefined : clock.now() + held.holdsFor;

      const expiresAt = answer.expiresAt ?? confirmedFor;

      const read = {
        ...held.read,
        ...(expiresAt === undefined ? {} : { expiresAt }),
      };

      memory = { ...held, read };

      return read;
    },
  });
};
