import type { ContainerLike } from "src/types/ContainerLike";
import type { RegistrationLike } from "src/types/RegistrationLike";
import type { WorkerLike } from "src/types/WorkerLike";
import type { WorkerMessage } from "src/types/WorkerMessage";

export type FakeWorker = WorkerLike & {
  messages: WorkerMessage[];
  listeners: () => number;
  transition: (state: WorkerLike["state"]) => void;
};

export const fakeWorker = (
  state: WorkerLike["state"] = "installed",
): FakeWorker => {
  const listeners = new Set<() => void>();

  const worker: FakeWorker = {
    state,
    messages: [],
    postMessage: (message) => {
      worker.messages.push(message);
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    listeners: () => listeners.size,
    transition: (next) => {
      worker.state = next;

      for (const listener of [...listeners]) {
        listener();
      }
    },
  };

  return worker;
};

export type FakeRegistration = RegistrationLike & {
  installing: FakeWorker | null;
  waiting: FakeWorker | null;
  active: FakeWorker | null;
  updates: () => number;
  listeners: () => number;
  /** A newer script is found and starts installing. */
  found: (worker: FakeWorker) => void;
  /** The installing worker finished installing and waits. */
  install: () => void;
  /** The waiting worker takes over as the active one. */
  activate: () => void;
  failNextUpdate: (error: Error) => void;
  /** The browser's update check answers only once `releaseUpdates` is called. */
  holdUpdates: () => void;
  releaseUpdates: () => void;
};

export const fakeRegistration = ({
  active = null,
  waiting = null,
}: {
  active?: FakeWorker | null;
  waiting?: FakeWorker | null;
} = {}): FakeRegistration => {
  const listeners = new Set<() => void>();
  const counts = { updates: 0 };
  const failures: Error[] = [];
  const held: Array<() => void> = [];
  const state = { holding: false };

  const announce = () => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const registration: FakeRegistration = {
    installing: null,
    waiting,
    active,
    update: async () => {
      counts.updates += 1;

      if (state.holding) {
        await new Promise<void>((resolve) => {
          held.push(resolve);
        });
      }

      const failure = failures.shift();

      if (failure === undefined) {
        return;
      }

      throw failure;
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    updates: () => counts.updates,
    listeners: () => listeners.size,
    found: (worker) => {
      worker.state = "installing";
      registration.installing = worker;
      announce();
    },
    install: () => {
      const { installing } = registration;

      registration.installing = null;
      registration.waiting = installing;
      installing?.transition("installed");
    },
    activate: () => {
      const { waiting: next, active: previous } = registration;

      registration.waiting = null;
      registration.active = next;
      previous?.transition("redundant");
      next?.transition("activated");
    },
    failNextUpdate: (error) => {
      failures.push(error);
    },
    holdUpdates: () => {
      state.holding = true;
    },
    releaseUpdates: () => {
      state.holding = false;

      for (const resolve of held.splice(0)) {
        resolve();
      }
    },
  };

  return registration;
};

export type FakeContainer = ContainerLike & {
  listeners: () => number;
  changeController: () => void;
  registrationReads: () => number;
};

export const fakeContainer = (
  registration: () => RegistrationLike | undefined,
): FakeContainer => {
  const listeners = new Set<() => void>();
  const counts = { reads: 0 };

  return {
    getRegistration: async () => {
      counts.reads += 1;

      return registration();
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    listeners: () => listeners.size,
    changeController: () => {
      for (const listener of [...listeners]) {
        listener();
      }
    },
    registrationReads: () => counts.reads,
  };
};

// The total number of listeners a driver holds on the fakes, which is what a leak looks like.
export const countListeners = (
  registration: FakeRegistration,
  container: FakeContainer,
) => {
  const workers = [
    registration.installing,
    registration.waiting,
    registration.active,
  ];

  return (
    registration.listeners() +
    container.listeners() +
    workers.reduce((sum, worker) => sum + (worker?.listeners() ?? 0), 0)
  );
};
