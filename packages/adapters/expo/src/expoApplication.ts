import type { RunningReader } from "@priemskiyyy/beacon";

import type { ExpoApplicationOptions } from "src/types/ExpoApplicationOptions";
import { assertNativeOptions } from "src/utils/assertNativeOptions";
import { readNativeRelease } from "src/utils/readNativeRelease";

/**
 * The reader of the installed binary, from the constants of `expo-application`:
 * the build number under the application id the binary reports, named the way
 * the store adapters name their releases, so a journal and a support policy
 * compare like with like. The platform and the authority are the scope's, which
 * the reader is given each time it runs: an Android build is its version code
 * under the domain `android-version-code`, and an iOS build its build number
 * under `ios-build`; a scope of any other platform is unknown, with the reason
 * `unsupported-platform`, and the module is not asked. A value the module gave
 * as null or empty is unknown, with the reason `build-not-read` or
 * `application-not-read`, and never a build named null. A binary of another
 * application than `scope.application`, such as Expo Go running this code, is
 * unknown with the reason `another-application`, and none of its version
 * numbers is kept. The marketing version is the label and `raw.shortVersion` on
 * iOS, which the App Store adapter reads. It is made for the `native` subject:
 * pass it as the `native` reader; the constants are read when the reader runs,
 * not when it is made.
 *
 * @example
 * ```ts
 * new Beacon({
 *   scope,
 *   running: { native: expoApplication({ application: Application }) },
 *   routes,
 * });
 * ```
 */
export const expoApplication = ({
  application,
  ...options
}: ExpoApplicationOptions): RunningReader<"native"> => {
  assertNativeOptions(options);

  return ({ scope }) =>
    readNativeRelease(
      () => ({
        applicationId: application.applicationId,
        version: application.nativeApplicationVersion,
        build: application.nativeBuildVersion,
      }),
      options,
      scope,
    );
};
