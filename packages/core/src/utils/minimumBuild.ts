import type { MinimumBuildOptions } from "src/types/MinimumBuildOptions";
import type { SupportPolicy } from "src/types/SupportPolicy";
import type { SupportVerdict } from "src/types/SupportVerdict";
import {
  ANDROID_VERSION_CODE_DOMAIN,
  IOS_BUILD_DOMAIN,
} from "src/utils/constants/domains";
import { integer } from "src/utils/versions/integer";

const build = integer();

const unknown = (code: string): SupportVerdict<never> => ({
  status: "unknown",
  reasons: [{ code, subject: "native" }],
  remediation: [],
});

/**
 * The forced upgrade as a support policy: the running binary is unsupported
 * when its build number is below the minimum a source names. The minimum and
 * the build are compared as integers, so an Android version code and an iOS
 * build number both work, and a value that is not a whole number, such as a
 * dotted `1.2.0`, fails the policy with `INVALID_VERSION` instead of being
 * guessed. The verdict is `unknown`, never supported and never too old, with
 * the reason `native-build-not-read` while the `native` fact is pending,
 * failed or unconfigured, and `native-build-unreadable` when its identity is
 * unknown, is not named in `android-version-code` or `ios-build`, or is of
 * another authority than the one you give. An older build is `unsupported`
 * with the reason `native-build-too-old` and, if you name one, the route that
 * sends it to the store.
 *
 * @example
 * ```ts
 * const policy = minimumBuild({
 *   source: manifest.select((document) => document.minimumBuild),
 *   remediation: "store",
 * });
 * ```
 */
export const minimumBuild = <TDocument, TRoute extends string = never>({
  source,
  authority,
  remediation,
  level = "required",
}: MinimumBuildOptions<TDocument, TRoute>): SupportPolicy<
  TDocument,
  string,
  // Only the remediation names a route: written inline in the options of a Beacon, the Beacon's own routes are no evidence of which one this policy sends a build to.
  NoInfer<TRoute>
> => ({
  // The same source, so the policy shares its one read with the routes that select from it.
  source: {
    source: source.source,
    project: (document) => build.parse(source.project(document)),
  },
  evaluate: (minimum, running): SupportVerdict<TRoute> => {
    const { native } = running;

    if (native.state !== "known") {
      return unknown("native-build-not-read");
    }

    const { identity } = native.release;

    if (
      identity.status !== "known" ||
      (identity.domain !== ANDROID_VERSION_CODE_DOMAIN &&
        identity.domain !== IOS_BUILD_DOMAIN) ||
      (authority !== undefined && identity.authority !== authority)
    ) {
      return unknown("native-build-unreadable");
    }

    if (build.compare(build.parse(identity.value), minimum) !== "older") {
      return { status: "supported", reasons: [], remediation: [] };
    }

    return {
      status: "unsupported",
      reasons: [{ code: "native-build-too-old", subject: "native" }],
      remediation:
        remediation === undefined ? [] : [{ route: remediation, level }],
    };
  },
});
