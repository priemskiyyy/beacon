import type { AppStateLike } from "src/triggers/types/AppStateLike";
import type { ConditionLike } from "src/triggers/types/ConditionLike";
import type { ForegroundSourceLike } from "src/triggers/types/ForegroundSourceLike";
import type { NetInfoLike } from "src/triggers/types/NetInfoLike";
import type { Subscribable } from "src/triggers/types/Subscribable";

// React Native's `AppState`, driven by hand. Like the real one it updates `currentState` before it tells a listener.
export const fakeAppState = (currentState: string | null = "active") => {
  const listeners = new Set<(state: string) => void>();

  const appState: AppStateLike = {
    currentState,
    addEventListener: (_type, listener) => {
      listeners.add(listener);

      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
  };

  return {
    appState,
    emit: (state: string) => {
      appState.currentState = state;

      for (const listener of [...listeners]) {
        listener(state);
      }
    },
    listeners: () => listeners.size,
  };
};

// NetInfo, which tells a listener the state it knows as soon as it subscribes, as the real one does.
export const fakeNetInfo = (isConnected: boolean | null = true) => {
  const state = { isConnected };
  const listeners = new Set<(state: { isConnected: boolean | null }) => void>();

  const netInfo: NetInfoLike = {
    addEventListener: (listener) => {
      listeners.add(listener);
      listener({ isConnected: state.isConnected });

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    netInfo,
    emit: (next: boolean | null) => {
      state.isConnected = next;

      for (const listener of [...listeners]) {
        listener({ isConnected: next });
      }
    },
    listeners: () => listeners.size,
  };
};

// A Pulse: a return, with how long the app was away, and a departure.
export const fakePulse = () => {
  const foreground = new Set<
    (event: { observedAway: number | null }) => void
  >();

  const background = new Set<() => void>();

  const source: ForegroundSourceLike = {
    on: (
      type: "foreground" | "background",
      listener: (event: { observedAway: number | null }) => void,
    ) => {
      const listeners = type === "foreground" ? foreground : background;

      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    source,
    leave: () => {
      for (const listener of [...background]) {
        listener();
      }
    },
    returnToApp: (observedAway: number | null) => {
      for (const listener of [...foreground]) {
        listener({ observedAway });
      }
    },
    listeners: () => foreground.size + background.size,
  };
};

// A Reach condition, which never calls back at once.
export const fakeCondition = (status: "met" | "unmet" | "unknown" = "met") => {
  const state = { status };
  const listeners = new Set<() => void>();

  const condition: ConditionLike = {
    get: () => ({ status: state.status }),
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    condition,
    set: (next: "met" | "unmet" | "unknown") => {
      state.status = next;

      for (const listener of [...listeners]) {
        listener();
      }
    },
    listeners: () => listeners.size,
  };
};

// A push channel whose messages carry a payload the trigger must never read.
export const fakeChannel = () => {
  const listeners = new Set<() => void>();

  const source: Subscribable = {
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    source,
    push: () => {
      for (const listener of [...listeners]) {
        listener();
      }
    },
    listeners: () => listeners.size,
  };
};
