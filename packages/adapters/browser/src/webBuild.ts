import type { RunningReader } from "@priemskiyyy/beacon";

import type { WebBuildOptions } from "src/types/WebBuildOptions";
import { assertIdentityText } from "src/utils/assertIdentityText";
import { WEB_ARTIFACT_DOMAIN } from "src/utils/constants/authority";
import { BUILD_ID_NOT_INJECTED_IDENTITY } from "src/utils/constants/identities";
import { readBuildText } from "src/utils/readBuildText";

/**
 * The reader of the running web build, from the id the bundler writes into the
 * code, such as `import.meta.env.VITE_BUILD_ID`: the build is named under the
 * authority you give and the domain `web-artifact`, the words the standard
 * manifest uses, so a route and the journal compare it with what the manifest
 * says. An id that nobody defined compiles to `undefined`, null or an empty
 * string, or to the text `undefined`, and the build is then unknown, with the
 * reason `build-id-not-injected`, and never a build named `undefined`. The
 * label is the id unless you give one. It reads nothing from the document, so
 * a server render creates it and reads it without a window. Pass it as the
 * `web` reader.
 *
 * @example
 * ```ts
 * new Beacon({
 *   scope,
 *   running: {
 *     boot: { id: createBootId() },
 *     web: webBuild({ authority: scope.application, id: BUILD_ID }),
 *   },
 *   routes: { web },
 * });
 * ```
 */
export const webBuild = ({
  authority,
  id,
  label,
  domain = WEB_ARTIFACT_DOMAIN,
}: WebBuildOptions): RunningReader => {
  assertIdentityText("authority", authority);
  assertIdentityText("domain", domain);

  return () => {
    const value = readBuildText(id);
    const name = readBuildText(label);

    if (value === null) {
      return { identity: BUILD_ID_NOT_INJECTED_IDENTITY, label: name, raw: {} };
    }

    return {
      identity: { status: "known", authority, domain, value },
      label: name ?? value,
      raw: {},
    };
  };
};
