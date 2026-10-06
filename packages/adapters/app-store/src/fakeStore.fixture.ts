import type { ReleaseScope } from "@priemskiyyy/beacon";

import type { AppStoreLookupEntry } from "src/types/AppStoreLookupEntry";
import type { AppStoreFetchContext } from "src/types/AppStoreFetchContext";
import type { AppStoreLookupResponse } from "src/types/AppStoreLookupResponse";
import type { LinkingLike } from "src/types/LinkingLike";

export const APP_ID = "284882215";
export const BUNDLE_ID = "com.example.notes";

export const SCOPE: ReleaseScope = {
  application: BUNDLE_ID,
  environment: "production",
  platform: "ios",
  distribution: "app-store",
};

export const entry = (
  overrides: Partial<AppStoreLookupEntry> = {},
): AppStoreLookupEntry => ({
  trackId: Number(APP_ID),
  bundleId: BUNDLE_ID,
  version: "3.3.0",
  currentVersionReleaseDate: "2026-09-02T09:15:00Z",
  ...overrides,
});

// An App Store lookup whose answer a test scripts, and whose fetches it records.
export const fakeStore = (initial: AppStoreLookupEntry[] = [entry()]) => {
  const fetches: AppStoreFetchContext[] = [];

  const state: { results: AppStoreLookupEntry[]; failure: Error | null } = {
    results: initial,
    failure: null,
  };

  return {
    fetches,
    reads: () => fetches.length,
    fetch: async (
      context: AppStoreFetchContext,
    ): Promise<AppStoreLookupResponse> => {
      fetches.push(context);

      if (state.failure !== null) {
        throw state.failure;
      }

      return { results: state.results };
    },
    publish: (results: AppStoreLookupEntry[]) => {
      state.results = results;
    },
    fail: (error: Error | null) => {
      state.failure = error;
    },
  };
};

// A link opener that records what it was asked to open.
export const fakeLinking = () => {
  const opened: string[] = [];
  const state: { failure: Error | null } = { failure: null };

  const linking: LinkingLike = {
    openURL: async (url) => {
      opened.push(url);

      if (state.failure === null) {
        return;
      }

      throw state.failure;
    },
  };

  return {
    linking,
    opened,
    fail: (error: Error | null) => {
      state.failure = error;
    },
  };
};
