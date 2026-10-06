import { BeaconError, WEB_ARTIFACT_DOMAIN } from "@priemskiyyy/beacon";
import type { Release } from "@priemskiyyy/beacon";

import type { WebReleaseOptions } from "src/types/WebReleaseOptions";
import { assertIdentityText } from "src/utils/assertIdentityText";
import { readBuildText } from "src/utils/readBuildText";

/**
 * The release a source names for the web: the build it says should run, in the
 * authority you give and the domain `web-artifact`, which is what `webBuild`
 * reads back when that build runs. A custom source builds its decision with
 * it, so no identity is written by hand and the words cannot drift from the
 * reader's. The id is read as `webBuild` reads it, so a padded id is the same
 * build; unlike a running build, a release cannot be unknown, so an id that is
 * empty or is the text a missing define compiles to throws
 * `INVALID_CONFIGURATION`, which a `select` turns into a failed check and not
 * into an offer of a build named `undefined`.
 *
 * @example
 * ```ts
 * declare const versionFile: ReleaseSource<{ build: string }>;
 *
 * const web = targetRoute({
 *   source: versionFile.select((file) => ({
 *     kind: "target",
 *     release: webRelease({ authority: "com.example.notes", id: file.build }),
 *   })),
 *   mechanism: browserReload(),
 * });
 * ```
 */
export const webRelease = ({
  authority,
  id,
  label,
}: WebReleaseOptions): Release => {
  assertIdentityText("authority", authority);

  const value = readBuildText(id);

  if (value === null) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message:
        "The id of a web release is text with no space around it, and not the text of a missing define.",
    });
  }

  const name = readBuildText(label);

  return {
    identity: {
      status: "known",
      authority,
      domain: WEB_ARTIFACT_DOMAIN,
      value,
    },
    ...(name === null ? {} : { label: name }),
  };
};
