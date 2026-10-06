import type { BrowserWindowLike } from "src/types/BrowserWindowLike";

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
