import type { ReleaseScope } from "@priemskiyyy/beacon";
import { createGate } from "@priemskiyyy/beacon/mock";

import type { CodePushLike } from "src/types/CodePushLike";
import type { DownloadProgressLike } from "src/types/DownloadProgressLike";
import type { LocalPackageLike } from "src/types/LocalPackageLike";
import type { RemotePackageLike } from "src/types/RemotePackageLike";

export const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "android",
  distribution: "google-play",
};

export const HASH_A =
  "9f2ce1c0a4b94d8f8c3e7a1b5d6f0a2e4c8b1d3f5a7c9e0b2d4f6a8c0e1b3d5f";
export const HASH_B =
  "3b7d90a1c2e4f6081a3c5e7092b4d6f8a0c2e4f6183a5c7e9b1d3f50a2c4e6b8";

// The real modules number their modes and states from 0, so these differ: a number written down instead of read from the module is caught.
const INSTALL_MODE = { ON_NEXT_RESTART: 7 };
const UPDATE_STATE = { RUNNING: 4, PENDING: 5 };

type PackageOptions = {
  label?: string;
  mandatory?: boolean;
  failedInstall?: boolean;
};

// What `restartApp` does: the forks implement it as an `async` function, and its declaration says it returns nothing.
export type RestartOutcome =
  | { kind: "returns" }
  | { kind: "resolves" }
  | { kind: "rejects"; error: Error }
  | { kind: "throws"; error: Error }
  | { kind: "never settles" };

// A package CodePush has on the device, as `getUpdateMetadata` answers it.
export const localPackage = (
  hash: string,
  { label = "v1", mandatory = false }: PackageOptions = {},
): LocalPackageLike => ({
  packageHash: hash,
  label,
  isMandatory: mandatory,
  install: async () => {},
});

const next = <TResult>(script: Array<TResult | Error>, fallback: TResult) => {
  const answer = script.shift() ?? fallback;

  if (answer instanceof Error) {
    throw answer;
  }

  return answer;
};

// A CodePush module whose answers a test scripts, whose calls it counts, and whose progress listeners and held calls it reports.
export const fakeCodePush = (
  initial: { running?: LocalPackageLike | null } = {},
) => {
  const calls = { checks: 0, downloads: 0, installs: 0, restarts: 0 };
  const checkArguments: number[] = [];
  const metadata: number[] = [];
  const installModes: number[] = [];
  const restartFlags: Array<boolean | undefined> = [];
  const listeners = new Set<(progress: DownloadProgressLike) => void>();
  const checks: Array<RemotePackageLike | null | Error> = [];
  const downloads: Array<Error | null> = [];
  const installs: Array<Error | null> = [];
  const restarts: RestartOutcome[] = [];
  const progress: DownloadProgressLike[] = [];

  const gates = {
    checks: createGate(),
    downloads: createGate(),
    installs: createGate(),
    metadata: createGate(),
  };

  const state: {
    running: LocalPackageLike | null;
    pending: LocalPackageLike | null;
    downloadsAs: string | null;
    installsNothing: boolean;
    readFailure: Error | null;
  } = {
    running: initial.running ?? null,
    pending: null,
    downloadsAs: null,
    installsNothing: false,
    readFailure: null,
  };

  // The package a download hands back, which installs itself for the next start like the real one.
  const downloaded = (hash: string, options: Required<PackageOptions>) => {
    const result: LocalPackageLike = {
      ...localPackage(hash, options),
      install: async function install(mode: number) {
        calls.installs += 1;
        installModes.push(mode);

        await gates.installs.wait();

        const failure = installs.shift() ?? null;

        if (failure !== null) {
          throw failure;
        }

        if (state.installsNothing) {
          return;
        }

        state.pending = localPackage(this.packageHash, options);
      },
    };

    return result;
  };

  // A package a check found, whose `download` reads the package it is called on, as the SDK's does.
  const remotePackage = (
    hash: string,
    {
      label = "v2",
      mandatory = false,
      failedInstall = false,
    }: PackageOptions = {},
  ): RemotePackageLike => ({
    packageHash: hash,
    label,
    isMandatory: mandatory,
    failedInstall,
    download: async function download(report) {
      calls.downloads += 1;

      if (report !== undefined) {
        listeners.add(report);
      }

      try {
        for (const event of progress.splice(0)) {
          report?.(event);
        }

        await gates.downloads.wait();

        const failure = downloads.shift() ?? null;

        if (failure !== null) {
          throw failure;
        }

        return downloaded(state.downloadsAs ?? this.packageHash, {
          label,
          mandatory,
          failedInstall,
        });
      } finally {
        if (report !== undefined) {
          listeners.delete(report);
        }
      }
    },
  });

  const restartApp = (
    onlyIfUpdateIsPending?: boolean,
  ): void | Promise<void> => {
    calls.restarts += 1;
    restartFlags.push(onlyIfUpdateIsPending);

    const outcome = restarts.shift() ?? { kind: "resolves" };

    if (outcome.kind === "throws") {
      throw outcome.error;
    }

    if (outcome.kind === "rejects") {
      return Promise.reject(outcome.error);
    }

    if (outcome.kind === "never settles") {
      return new Promise<void>(() => {});
    }

    if (outcome.kind === "resolves") {
      return Promise.resolve();
    }

    return undefined;
  };

  const codePush: CodePushLike = {
    checkForUpdate: async (...args: unknown[]) => {
      calls.checks += 1;
      checkArguments.push(args.length);

      await gates.checks.wait();

      return next(checks, null);
    },
    getUpdateMetadata: async (updateState?: number) => {
      metadata.push(updateState ?? UPDATE_STATE.RUNNING);

      await gates.metadata.wait();

      if (state.readFailure !== null && calls.installs > 0) {
        throw state.readFailure;
      }

      if (updateState === UPDATE_STATE.PENDING) {
        return state.pending;
      }

      return state.running;
    },
    restartApp,
    InstallMode: INSTALL_MODE,
    UpdateState: UPDATE_STATE,
  };

  return {
    codePush,
    calls,
    checkArguments,
    metadata,
    installModes,
    restartFlags,
    installMode: INSTALL_MODE.ON_NEXT_RESTART,
    updateState: UPDATE_STATE,
    remotePackage,
    // How many progress callbacks the module holds now: the SDK subscribes while a download runs.
    listeners: () => listeners.size,
    willCheck: (result: RemotePackageLike | null | Error) =>
      checks.push(result),
    willDownload: (failure: Error | null) => downloads.push(failure),
    willInstall: (failure: Error | null) => installs.push(failure),
    willRestart: (outcome: RestartOutcome) => restarts.push(outcome),
    // Progress the next download reports before it finishes.
    willReport: (event: DownloadProgressLike) => progress.push(event),
    // The next download hands back a package of another hash than the one offered.
    downloadsAs: (hash: string) => {
      state.downloadsAs = hash;
    },
    // An install that returns and leaves nothing pending.
    installsNothing: () => {
      state.installsNothing = true;
    },
    // From the first install on, every read of the module's metadata rejects.
    failsReadingAfterInstall: (failure: Error) => {
      state.readFailure = failure;
    },
    setRunning: (running: LocalPackageLike | null) => {
      state.running = running;
    },
    setPending: (pending: LocalPackageLike | null) => {
      state.pending = pending;
    },
    // A new launch, as the native side finds it: the pending package runs.
    launchAgain: () => {
      if (state.pending === null) {
        return;
      }

      state.running = state.pending;
      state.pending = null;
    },
    // Delivers a progress event to the callbacks the module holds now, as the native side does.
    report: (event: DownloadProgressLike) => {
      for (const listener of [...listeners]) {
        listener(event);
      }
    },
    hold: (call: keyof typeof gates) => gates[call].hold(),
    release: (call: keyof typeof gates) => gates[call].release(),
  };
};
