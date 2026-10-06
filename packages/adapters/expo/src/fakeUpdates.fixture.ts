import type { ReleaseScope } from "@priemskiyyy/beacon";
import { createGate } from "@priemskiyyy/beacon/mock";

import type { CheckResultLike } from "src/types/CheckResultLike";
import type { FetchResultLike } from "src/types/FetchResultLike";
import type { UpdatesLike } from "src/types/UpdatesLike";

export const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "ios",
  distribution: "app-store",
};

export const UPDATE_A = "8b2d5c1e-0a3f-4c8e-9d1b-6e7f2a4c5b90";
export const UPDATE_B = "3f9a7d20-51c4-4b6e-8a02-c1d4e9b7f356";
export const EMBEDDED = "00000000-0000-4000-8000-000000000001";

export const available = (id: string): CheckResultLike => ({
  isAvailable: true,
  isRollBackToEmbedded: false,
  manifest: { id },
  reason: undefined,
});

export const rollbackCheck = (): CheckResultLike => ({
  isAvailable: false,
  isRollBackToEmbedded: true,
  manifest: undefined,
  reason: undefined,
});

export const notAvailable = (reason: string): CheckResultLike => ({
  isAvailable: false,
  isRollBackToEmbedded: false,
  manifest: undefined,
  reason,
});

export const fetchedNew = (id: string): FetchResultLike => ({
  isNew: true,
  isRollBackToEmbedded: false,
  manifest: { id },
});

export const fetchedNothing = (): FetchResultLike => ({
  isNew: false,
  isRollBackToEmbedded: false,
  manifest: undefined,
});

export const fetchedRollback = (): FetchResultLike => ({
  isNew: false,
  isRollBackToEmbedded: true,
  manifest: undefined,
});

type Options = {
  isEnabled?: boolean;
  updateId?: string | null;
  isEmbeddedLaunch?: boolean;
  isEmergencyLaunch?: boolean;
};

// An `expo-updates` module whose answers a test scripts, and whose calls it counts.
export const fakeUpdates = ({
  isEnabled = true,
  updateId = EMBEDDED,
  isEmbeddedLaunch = true,
  isEmergencyLaunch = false,
}: Options = {}) => {
  const calls = { checks: 0, fetches: 0, reloads: 0 };
  const checks: Array<CheckResultLike | Error> = [];
  const fetches: Array<FetchResultLike | Error> = [];
  const reloads: Array<Error | null> = [];
  const gate = createGate();

  const next = <TResult>(script: Array<TResult | Error>, fallback: TResult) => {
    const answer = script.shift() ?? fallback;

    if (answer instanceof Error) {
      throw answer;
    }

    return answer;
  };

  const updates: UpdatesLike = {
    isEnabled,
    updateId,
    channel: "production",
    runtimeVersion: "1.0.0",
    isEmbeddedLaunch,
    isEmergencyLaunch,
    checkForUpdateAsync: async () => {
      calls.checks += 1;

      return next(checks, notAvailable("noUpdateAvailableOnServer"));
    },
    fetchUpdateAsync: async () => {
      calls.fetches += 1;

      await gate.wait();

      return next(fetches, fetchedNothing());
    },
    reloadAsync: async () => {
      calls.reloads += 1;

      const failure = reloads.shift() ?? null;

      if (failure === null) {
        return;
      }

      throw failure;
    },
  };

  return {
    updates,
    calls,
    willCheck: (result: CheckResultLike | Error) => checks.push(result),
    willFetch: (result: FetchResultLike | Error) => fetches.push(result),
    willReload: (failure: Error | null) => reloads.push(failure),
    holdFetches: gate.hold,
    releaseFetches: gate.release,
  };
};
