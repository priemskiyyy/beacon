import type { ReleaseScope } from "@priemskiyyy/beacon";
import { createGate } from "@priemskiyyy/beacon/mock";

import type { RemoteConfigModuleLike } from "src/types/RemoteConfigModuleLike";
import type { RemoteValueLike } from "src/types/RemoteValueLike";

export const APPLICATION = "com.example.notes";

export const SCOPE: ReleaseScope = {
  application: APPLICATION,
  environment: "production",
  platform: "android",
  distribution: "google-play",
};

export const HOUR = 3_600_000;

/** An epoch time to start from, so that a fetch time is never mistaken for "never" (-1 or 0). */
export const START = 1_790_000_000_000;

/** The instance a real SDK hands out. React Native Firebase's `settings` also carries a `fetchTimeMillis` that is the fetch timeout, which is not when the last fetch was. */
export type FakeInstance = {
  fetchTimeMillis: number;
  settings: {
    minimumFetchIntervalMillis: number;
    fetchTimeoutMillis: number;
    fetchTimeMillis: number;
  };
};

type Stored = { at: number; config: Record<string, string> };

export type FakeOptions = {
  /** The clock a cache hit is judged by, the test clock's `now`. */
  now: () => number;
  interval?: number;
  /** What `fetchTimeMillis` says before any fetch: -1 on the web and Android, 0 on iOS. */
  never?: number;
  /** What an earlier run of the application activated, which the SDK holds once it is initialized. */
  stored?: Stored;
  defaults?: Record<string, string>;
};

// A Remote Config SDK that keeps what the real web SDK does (firebase 12.19.0, read and run): a fetch inside the minimum interval is answered from its cache with no request and no new time, a fetch that reaches the server moves the time, an activated value is `remote`, an application default is `default` and any other key is `static`. As on a device, neither the time nor an activated value is there before the SDK is initialized.
export const fakeRemoteConfig = ({
  now,
  interval = 12 * HOUR,
  never = -1,
  stored,
  defaults = {},
}: FakeOptions) => {
  const calls = { ensureInitialized: 0, fetchAndActivate: 0, network: 0 };
  const log: string[] = [];
  const gate = createGate();

  const state: {
    initialized: boolean;
    fetchTime: number;
    activated: Record<string, string>;
    server: Record<string, string>;
    failure: Error | null;
    initFailure: Error | null;
    forced: Record<string, string>;
  } = {
    initialized: false,
    fetchTime: stored === undefined ? never : stored.at,
    activated: stored === undefined ? {} : stored.config,
    server: {},
    failure: null,
    initFailure: null,
    forced: {},
  };

  const remoteConfig: FakeInstance = {
    get fetchTimeMillis() {
      if (!state.initialized) {
        return never;
      }

      return state.fetchTime;
    },
    settings: {
      minimumFetchIntervalMillis: interval,
      fetchTimeoutMillis: 60_000,
      fetchTimeMillis: 60_000,
    },
  };

  const read = (key: string): RemoteValueLike => {
    const forced = state.forced[key];
    const activated = state.initialized ? state.activated[key] : undefined;
    const fallback = defaults[key];

    if (activated !== undefined) {
      return { asString: () => activated, getSource: () => forced ?? "remote" };
    }

    if (fallback !== undefined) {
      return { asString: () => fallback, getSource: () => forced ?? "default" };
    }

    return { asString: () => "", getSource: () => forced ?? "static" };
  };

  const sdk: RemoteConfigModuleLike<FakeInstance> = {
    ensureInitialized: async () => {
      calls.ensureInitialized += 1;
      log.push("ensureInitialized");

      if (state.initFailure !== null) {
        throw state.initFailure;
      }

      state.initialized = true;
    },
    fetchAndActivate: async () => {
      calls.fetchAndActivate += 1;
      log.push("fetchAndActivate");

      await gate.wait();

      const age = now() - state.fetchTime;

      if (
        state.fetchTime > 0 &&
        age <= remoteConfig.settings.minimumFetchIntervalMillis
      ) {
        return false;
      }

      if (state.failure !== null) {
        throw state.failure;
      }

      calls.network += 1;
      state.fetchTime = now();
      state.activated = { ...state.server };

      return true;
    },
    getValue: (_, key) => {
      log.push(`getValue ${key}`);

      return read(key);
    },
  };

  return {
    remoteConfig,
    sdk,
    calls,
    log,
    reads: () => calls.fetchAndActivate,
    /** What the server sends from the next request on. */
    serve: (entries: Record<string, string>) => {
      state.server = entries;
    },
    /** Makes every request to the server fail, or stops doing so. */
    fail: (error: Error | null) => {
      state.failure = error;
    },
    /** Makes the initialization fail, or stops doing so. */
    failInitialization: (error: Error | null) => {
      state.initFailure = error;
    },
    /** What `getSource()` says for a key whatever it holds, such as `unknown` from the iOS module. */
    force: (key: string, source: string) => {
      state.forced[key] = source;
    },
    /** Holds the next fetch until `release`, as a slow network does. */
    hold: gate.hold,
    release: gate.release,
  };
};
