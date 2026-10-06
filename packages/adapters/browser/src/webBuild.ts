import { WEB_ARTIFACT_DOMAIN } from "@priemskiyyy/beacon";
import type { RunningReader } from "@priemskiyyy/beacon";

import type { WebBuildOptions } from "src/types/WebBuildOptions";
import { assertIdentityText } from "src/utils/assertIdentityText";
import { BUILD_ID_NOT_INJECTED_IDENTITY } from "src/utils/constants/identities";
import { readBuildText } from "src/utils/readBuildText";

/**
 * The reader of the running web build, from the id the bundler writes into the
 * code, such as `import.meta.env.VITE_BUILD_ID`: the build is named under the
 * application of the scope, which the reader is given each time it runs, and
 * the domain `web-artifact`, the words the standard manifest uses, so a route
 * and the journal compare it with what the manifest says. Pass `authority` only
 * for a manifest that names its builds under another one. An id that nobody
 * defined compiles to `undefined`, null or an empty string, or to the text
 * `undefined`, and the build is then unknown, with the reason
 * `build-id-not-injected`, and never a build named `undefined`. The label is
 * the id unless you give one. It reads nothing from the document, so a server
 * render creates it and reads it without a window. It is made for the `web`
 * subject: pass it as the `web` reader, and the `bundle` slot refuses it.
 *
 * @example
 * ```ts
 * new Beacon({
 *   scope,
 *   running: { web: webBuild({ id: BUILD_ID }) },
 *   routes: { web },
 * });
 * ```
 */
export const webBuild = ({
  authority,
  id,
  label,
  domain = WEB_ARTIFACT_DOMAIN,
}: WebBuildOptions): RunningReader<"web"> => {
  if (authority !== undefined) {
    assertIdentityText("authority", authority);
  }

  assertIdentityText("domain", domain);

  // A plain parameter and no async: Hermes V1 resolves undefined from an async arrow with a destructured one, and this reader answers at once.
  return ({ scope }) => {
    const value = readBuildText(id);
    const name = readBuildText(label);

    if (value === null) {
      return { identity: BUILD_ID_NOT_INJECTED_IDENTITY, label: name, raw: {} };
    }

    return {
      identity: {
        status: "known",
        authority: authority ?? scope.application,
        domain,
        value,
      },
      label: name ?? value,
      raw: {},
    };
  };
};
