import type { RunningReader } from "@priemskiyyy/beacon";

import type { DeviceInfoOptions } from "src/types/DeviceInfoOptions";
import { assertNativeOptions } from "src/utils/assertNativeOptions";
import { readDeviceInfoText } from "src/utils/readDeviceInfoText";
import { readNativeRelease } from "src/utils/readNativeRelease";

/**
 * The reader of the installed binary, from `react-native-device-info`: the
 * build number under the application id the binary reports, named the way the
 * store adapters name their releases, so a journal and a support policy compare
 * like with like. An Android build is its version code under the domain
 * `android-version-code`, and an iOS build its build number under `ios-build`.
 * The library answers the text `unknown` where it has no value, and that is
 * taken for a value that was not read: the identity is unknown, with the reason
 * `build-not-read` or `application-not-read`, never a build named `unknown`.
 * Pass `authority: scope.application` and a binary of another application is
 * unknown with the reason `another-application`, and none of its version
 * numbers is kept. The marketing version is the label and `raw.shortVersion`
 * on iOS, which the App Store adapter reads. Its calls are synchronous, and if
 * one throws the reader rejects, which Beacon publishes as a failed fact and
 * never as a build. Pass it as the `native` reader; the library is asked when
 * the reader runs, not when it is made.
 *
 * @example
 * ```ts
 * new Beacon({
 *   scope,
 *   running: {
 *     boot: { id: createBootId() },
 *     native: deviceInfo({
 *       deviceInfo: DeviceInfo,
 *       platform: "ios",
 *       authority: scope.application,
 *     }),
 *   },
 *   routes,
 * });
 * ```
 */
export const deviceInfo = ({
  deviceInfo: sdk,
  ...options
}: DeviceInfoOptions): RunningReader => {
  assertNativeOptions(options);

  return async () =>
    readNativeRelease(
      {
        applicationId: readDeviceInfoText(sdk.getBundleId()),
        version: readDeviceInfoText(sdk.getVersion()),
        build: readDeviceInfoText(sdk.getBuildNumber()),
      },
      options,
    );
};
