import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { BrowserWindowLike } from "src/types/BrowserWindowLike";

/** The application id of the page under test, which is `scope.application` and the authority of its builds. */
export const APPLICATION = "com.example.notes";

export const SCOPE: ReleaseScope = {
  application: APPLICATION,
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

export type FakeWindow = BrowserWindowLike & {
  reloads: () => number;
  locationReads: () => number;
};

// A window whose location counts how it is used, so a test can prove when the mechanism touches it.
export const fakeWindow = ({
  failsToReload = false,
}: { failsToReload?: boolean } = {}): FakeWindow => {
  const counts = { reloads: 0, locationReads: 0 };

  return {
    get location() {
      counts.locationReads += 1;

      return {
        reload: () => {
          if (failsToReload) {
            throw new Error("navigation blocked");
          }

          counts.reloads += 1;
        },
      };
    },
    reloads: () => counts.reloads,
    locationReads: () => counts.locationReads,
  };
};
