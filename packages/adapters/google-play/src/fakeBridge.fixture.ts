import type { PlayBridge } from "src/types/PlayBridge";
import type { PlayFlowResult } from "src/types/PlayFlowResult";
import type { PlayInstallEvent } from "src/types/PlayInstallEvent";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";

export const availableInfo = (
  versionCode: number,
  overrides: Partial<
    Extract<PlayUpdateInfo, { availability: "available" }>
  > = {},
): PlayUpdateInfo => ({
  availability: "available",
  versionCode,
  flexible: true,
  immediate: true,
  priority: 2,
  stalenessDays: 5,
  installStatus: "unknown",
  ...overrides,
});

export const downloading = (
  bytesDownloaded: number | null,
  totalBytes: number | null,
): PlayInstallEvent => ({ status: "downloading", bytesDownloaded, totalBytes });

export const installEvent = (
  status: PlayInstallEvent["status"],
): PlayInstallEvent => ({
  status,
  bytesDownloaded: null,
  totalBytes: null,
});

// A native Play bridge whose answers a test scripts, and whose calls and listeners it counts.
export const fakeBridge = (
  initial: PlayUpdateInfo = { availability: "not-available" },
) => {
  const listeners = new Set<(event: PlayInstallEvent) => void>();
  const calls = { queries: 0, flexible: 0, immediate: 0, completions: 0 };

  const flows: Record<"flexible" | "immediate", PlayFlowResult> = {
    flexible: "started",
    immediate: "started",
  };

  const state: {
    info: PlayUpdateInfo;
    failure: Error | null;
    holding: boolean;
    ignoringRemoval: boolean;
  } = {
    info: initial,
    failure: null,
    holding: false,
    ignoringRemoval: false,
  };

  const held: Array<() => void> = [];

  const bridge: PlayBridge = {
    getUpdateInfo: async () => {
      calls.queries += 1;

      if (state.holding) {
        await new Promise<void>((resolve) => {
          held.push(resolve);
        });
      }

      if (state.failure !== null) {
        throw state.failure;
      }

      return state.info;
    },
    startFlexible: async () => {
      calls.flexible += 1;

      return flows.flexible;
    },
    startImmediate: async () => {
      calls.immediate += 1;

      return flows.immediate;
    },
    completeUpdate: async () => {
      calls.completions += 1;
    },
    addInstallListener: (listener) => {
      listeners.add(listener);

      return () => {
        if (state.ignoringRemoval) {
          return;
        }

        listeners.delete(listener);
      };
    },
  };

  return {
    bridge,
    calls,
    listeners: () => listeners.size,
    setInfo: (info: PlayUpdateInfo) => {
      state.info = info;
    },
    holdQueries: () => {
      state.holding = true;
    },
    releaseQueries: () => {
      state.holding = false;

      for (const resolve of held.splice(0)) {
        resolve();
      }
    },
    failQueries: (error: Error | null) => {
      state.failure = error;
    },
    // A bridge whose native side keeps delivering after the listener was removed.
    ignoreRemoval: () => {
      state.ignoringRemoval = true;
    },
    setFlow: (flow: "flexible" | "immediate", result: PlayFlowResult) => {
      flows[flow] = result;
    },
    install: (event: PlayInstallEvent) => {
      for (const listener of [...listeners]) {
        listener(event);
      }
    },
  };
};
