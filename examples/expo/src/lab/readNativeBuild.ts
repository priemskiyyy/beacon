import type { RunningRelease } from "@priemskiyyy/beacon";

/** The part of `expo-application` the reader uses: the module satisfies it. */
export type ApplicationLike = {
  applicationId: string | null;
  nativeApplicationVersion: string | null;
  nativeBuildVersion: string | null;
};

// What the native module gave, or null when it gave nothing or only spaces.
const readText = (value: string | null) => {
  const text = value?.trim() ?? "";

  if (text === "") {
    return null;
  }

  return text;
};

/**
 * The reader of the installed binary, from the constants of `expo-application`,
 * named in the vocabulary of the store adapters: an Android build by its
 * version code and an iOS one by its build number, under the application id
 * the binary reports. A value the module gave as null or empty, or a binary of
 * another application (Expo Go, running this code, describes itself), is
 * unknown and never a build named null.
 */
export const readNativeBuild =
  (
    application: ApplicationLike,
    platform: "android" | "ios",
    expected: string,
  ) =>
  (): RunningRelease => {
    const build = readText(application.nativeBuildVersion);
    const version = readText(application.nativeApplicationVersion);

    if (application.applicationId !== expected) {
      return {
        identity: { status: "unknown", reason: "another-application" },
        label: null,
        raw: { applicationId: application.applicationId },
      };
    }

    const raw =
      platform === "android"
        ? { applicationId: expected, versionName: version, versionCode: build }
        : {
            applicationId: expected,
            shortVersion: version,
            buildNumber: build,
          };

    if (build === null) {
      return {
        identity: { status: "unknown", reason: "native-build-not-read" },
        label: version,
        raw,
      };
    }

    return {
      identity: {
        status: "known",
        authority: expected,
        domain: platform === "android" ? "android-version-code" : "ios-build",
        value: build,
      },
      label: version,
      raw,
    };
  };
