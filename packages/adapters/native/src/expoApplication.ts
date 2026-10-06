import type { RunningReader } from "@priemskiyyy/beacon";

import type { ExpoApplicationOptions } from "src/types/ExpoApplicationOptions";
import { assertNativeOptions } from "src/utils/assertNativeOptions";
import { readNativeRelease } from "src/utils/readNativeRelease";

/**
 * The reader of the installed binary, from the constants of `expo-application`:
 * the build number under the application id the binary reports, named the way
 * the store adapters name their releases, so a journal and a support policy
 * compare like with like. An Android build is its version code under the domain
 * `android-version-code`, and an iOS build its build number under `ios-build`.
 * A value the module gave as null or empty is unknown, with the reason
 * `build-not-read` or `application-not-read`, and never a build named null.
 * Pass `authority: scope.application` and a binary of another application,
 * such as Expo Go running this code, is unknown with the reason
 * `another-application`, and none of its version numbers is kept. The marketing
 * version is the label and `raw.shortVersion` on iOS, which the App Store
 * adapter reads. Pass it as the `native` reader; the constants are read when
 * the reader runs, not when it is made.
 *
 * @example
 * ```ts
 * new Beacon({
 *   scope,
 *   running: {
 *     boot: { id: createBootId() },
 *     native: expoApplication({
 *       application: Application,
 *       platform: "android",
 *       authority: scope.application,
 *     }),
 *   },
 *   routes,
 * });
 * ```
 */
export const expoApplication = ({
  application,
  ...options
}: ExpoApplicationOptions): RunningReader => {
  assertNativeOptions(options);

  return () =>
    readNativeRelease(
      {
        applicationId: application.applicationId,
        version: application.nativeApplicationVersion,
        build: application.nativeBuildVersion,
      },
      options,
    );
};
