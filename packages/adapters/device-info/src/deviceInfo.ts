import type { RunningReader } from "@priemskiyyy/beacon";

import type { DeviceInfoOptions } from "src/types/DeviceInfoOptions";
import { assertNativeOptions } from "src/utils/assertNativeOptions";
import { readDeviceInfoText } from "src/utils/readDeviceInfoText";
import { readNativeRelease } from "src/utils/readNativeRelease";

/**
 * The reader of the installed binary, from `react-native-device-info`: the
 * build number under the application id the binary reports, named the way the
 * store adapters name their releases, so a journal and a support policy compare
 * like with like. The platform and the authority are the scope's, which the
 * reader is given each time it runs: an Android build is its version code under
 * the domain `android-version-code`, and an iOS build its build number under
 * `ios-build`; a scope of any other platform is unknown, with the reason
 * `unsupported-platform`, and the library is not asked. The library answers the
 * text `unknown` where it has no value, and that is taken for a value that was
 * not read: the identity is unknown, with the reason `build-not-read` or
 * `application-not-read`, never a build named `unknown`. A binary of another
 * application than `scope.application` is unknown with the reason
 * `another-application`, and none of its version numbers is kept. The
 * marketing version is the label and `raw.shortVersion` on iOS, which the App
 * Store adapter reads. Its calls are synchronous, and if one throws the reader
 * rejects, which Beacon publishes as a failed fact and never as a build. It is
 * made for the `native` subject: pass it as the `native` reader; the library is
 * asked when the reader runs, not when it is made.
 *
 * @example
 * ```ts
 * new Beacon({
 *   scope: { application: "com.example.notes", environment: "production", platform: Platform.OS, distribution: "app-store" },
 *   running: { native: deviceInfo({ deviceInfo: DeviceInfo }) },
 *   routes,
 * });
 * ```
 */
export const deviceInfo = ({
  deviceInfo: sdk,
  ...options
}: DeviceInfoOptions): RunningReader<"native"> => {
  assertNativeOptions(options);

  // A plain parameter: Hermes V1 resolves undefined from an async arrow with a destructured one.
  return async (context) =>
    readNativeRelease(
      () => ({
        applicationId: readDeviceInfoText(sdk.getBundleId()),
        version: readDeviceInfoText(sdk.getVersion()),
        build: readDeviceInfoText(sdk.getBuildNumber()),
      }),
      options,
      context.scope,
    );
};
