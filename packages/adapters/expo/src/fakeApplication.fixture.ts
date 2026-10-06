import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { ApplicationLike } from "src/types/ApplicationLike";

/** The application id of the binary under test, which is also `scope.application` and the authority of what the Play adapter offers. */
export const APPLICATION = "com.example.notes";

export const SCOPE: ReleaseScope = {
  application: APPLICATION,
  environment: "production",
  platform: "android",
  distribution: "google-play",
};

type Facts = {
  applicationId?: string | null;
  version?: string | null;
  build?: string | null;
};

// The `expo-application` module as a test scripts it: constants a test can change between two reads, and a count of how often the reader looked at them.
export const fakeApplication = ({
  applicationId = APPLICATION,
  version = "2.4.0",
  build = "108",
}: Facts = {}) => {
  const facts = { applicationId, version, build };
  const asked = { reads: 0 };

  const application: ApplicationLike = {
    get applicationId() {
      asked.reads += 1;

      return facts.applicationId;
    },
    get nativeApplicationVersion() {
      asked.reads += 1;

      return facts.version;
    },
    get nativeBuildVersion() {
      asked.reads += 1;

      return facts.build;
    },
  };

  return { application, facts, reads: () => asked.reads };
};
