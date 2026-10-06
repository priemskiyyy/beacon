import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { createMockSource } from "src/mock/createMockSource";
import { testJournalStorage } from "src/testing/testJournalStorage";
import { testReleaseDriver } from "src/testing/testReleaseDriver";
import { testReleaseSource } from "src/testing/testReleaseSource";
import { testRunningReader } from "src/testing/testRunningReader";
import { testUpdateMechanism } from "src/testing/testUpdateMechanism";
import { testVersionStrategy } from "src/testing/testVersionStrategy";
import type { Release } from "src/types/Release";
import type { RunningReader } from "src/types/RunningReader";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import { createHeldMechanism } from "src/utils/commands.fixture";
import { createReleaseDriver } from "src/utils/createReleaseDriver";
import { createReleaseSource } from "src/utils/createReleaseSource";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { keyValueJournalStorage } from "src/utils/keyValueJournalStorage";
import { createFakeStore } from "src/utils/keyValueJournalStorage.fixture";
import { integer } from "src/utils/versions/integer";
import { semver } from "src/utils/versions/semver";

testReleaseSource({
  name: "mock",
  create: () => {
    const mock = createMockSource<{ web: string }>({ name: "manifest" });

    mock.answer({
      document: { web: "web-build-a" },
      revision: { kind: "ordered", domain: "web", epoch: "v1", value: "208" },
      digest: "a",
      expiresAt: 601_000,
    });

    return { source: mock.source, reads: () => mock.stats().reads };
  },
});

// A source that speaks for one distribution only is read for that scope.
testReleaseSource({
  name: "one distribution",
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "ios",
    distribution: "app-store",
  },
  create: () => {
    const reads = { count: 0 };

    const source = createReleaseSource<Record<string, never>>({
      name: "store",
      read: async ({ scope }) => {
        if (scope.distribution !== "app-store") {
          throw new Error("This source speaks for the app store only.");
        }

        reads.count += 1;

        return { document: {}, issuer: "store" };
      },
    });

    return { source, reads: () => reads.count };
  },
});

testVersionStrategy({
  name: "semver",
  create: () => semver(),
  ascending: ["1.0.0", "1.2.0", "2.0.0"],
  invalid: ["latest", "1.2"],
});

testVersionStrategy({
  name: "integer",
  create: () => integer(),
  ascending: [9, 10, 100],
  invalid: [-1, 1.5],
});

// A platform that reports its changes to whoever listens, and counts them.
const createFakePlatform = () => {
  const listeners = new Set<() => void>();

  return {
    listeners: () => listeners.size,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    update: () => {
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
};

testUpdateMechanism({
  name: "held",
  create: () => ({ mechanism: createHeldMechanism().mechanism }),
});

testUpdateMechanism({
  name: "one that listens while a session is open",
  create: () => {
    const platform = createFakePlatform();

    const mechanism = createUpdateMechanism({
      name: "listening",
      open: () => ({
        native: platform,
        dispose: platform.subscribe(() => {}),
      }),
      commands: {},
    });

    return { mechanism, held: platform.listeners };
  },
});

testReleaseDriver({
  name: "fake provider",
  create: () => {
    const provider = createFakePlatform();

    const route = createReleaseDriver({
      name: "fake-provider",
      subject: "native",
      prepares: false,
      open: ({ emit }) => {
        const unsubscribe = provider.subscribe(() => {
          emit.observation({
            status: "none",
            reason: "no-decision",
            detail: null,
          });
        });

        return {
          native: provider,
          check: async () => ({
            status: "none",
            reason: "no-decision",
            detail: null,
          }),
          dispose: unsubscribe,
        };
      },
      commands: {},
    });

    return { route, provider };
  },
});

// A provider that has a release to offer, and prepares it and reports progress when it changes.
const createPreparingDriver = (identity: ReleaseIdentity) => {
  const provider = createFakePlatform();
  const release: Release = { identity };

  const route = createReleaseDriver({
    name: "preparing-provider",
    subject: "bundle",
    prepares: true,
    open: ({ emit }) => {
      const unsubscribe = provider.subscribe(() => {
        emit.progress(0.5);
        emit.prepared({ status: "ready", value: { release } });
      });

      return {
        native: provider,
        check: async () => ({ status: "available", offer: { release } }),
        dispose: unsubscribe,
      };
    },
    commands: {},
  });

  return { route, provider };
};

testReleaseDriver({
  name: "fake provider that prepares",
  create: () =>
    createPreparingDriver({
      status: "known",
      authority: "com.example.conformance",
      domain: "bundle",
      value: "bundle-2",
    }),
});

testReleaseDriver({
  name: "fake provider that cannot name its release",
  create: () =>
    createPreparingDriver({ status: "unknown", reason: "not-reported" }),
});

testJournalStorage({
  name: "mock",
  create: () => {
    const first = createMockJournalStorage();

    return {
      storage: first,
      reopen: () => {
        const reopened = createMockJournalStorage();

        for (const [key, value] of first.records) {
          reopened.records.set(key, value);
        }

        return reopened;
      },
    };
  },
});

// A store that answers at once and says `null` for a missing key, as localStorage does.
testJournalStorage({
  name: "key-value store that answers at once",
  create: () => {
    const { store, backend } = createFakeStore();

    return {
      storage: keyValueJournalStorage(store),
      reopen: () => keyValueJournalStorage(createFakeStore({ backend }).store),
    };
  },
});

// A store that answers later and says `undefined` for a missing key, as some stores do.
testJournalStorage({
  name: "key-value store that answers later with undefined",
  create: () => {
    const { store, backend } = createFakeStore({
      answers: "later",
      missing: "undefined",
    });

    return {
      storage: keyValueJournalStorage(store),
      reopen: () =>
        keyValueJournalStorage(
          createFakeStore({ backend, answers: "later", missing: "undefined" })
            .store,
        ),
    };
  },
});

// A store with a narrow key alphabet, reached through an injective mapping of the key.
testJournalStorage({
  name: "key-value store with a mapped key and no read back",
  create: () => {
    const { store, backend } = createFakeStore({ answers: "later" });

    const options = {
      verify: false,
      key: (key: string) =>
        [...key].map((char) => char.charCodeAt(0).toString(16)).join("."),
    };

    return {
      storage: keyValueJournalStorage(store, options),
      reopen: () =>
        keyValueJournalStorage(
          createFakeStore({ backend, answers: "later" }).store,
          options,
        ),
    };
  },
});

// A fixture that cannot reopen still runs every check that does not need a restart.
testJournalStorage({
  name: "key-value store without a reopen",
  create: () => ({
    storage: keyValueJournalStorage(createFakeStore().store),
  }),
});

// A reader over a fake host that counts how often it is asked, as the readers of the adapters are.
const createBuildReader = (build: { id: string | null }) => {
  const host = { asked: 0 };

  const reader: RunningReader = () => {
    host.asked += 1;

    if (build.id === null) {
      return {
        identity: { status: "unknown", reason: "build-not-read" },
        label: null,
        raw: { embedded: true },
      };
    }

    return {
      identity: {
        status: "known",
        authority: "com.example.notes",
        domain: "native-android-build",
        value: build.id,
      },
      label: `Build ${build.id}`,
      raw: { channel: "production", build: 113, embedded: false },
    };
  };

  return { reader, reads: () => host.asked };
};

testRunningReader({
  name: "a reader over its host",
  create: () => createBuildReader({ id: "113" }),
  situations: [
    {
      name: "the host cannot name the build",
      answers: "unknown",
      create: () => createBuildReader({ id: null }),
    },
    {
      name: "the host is not there",
      answers: "rejection",
      create: () => ({
        reader: () => Promise.reject(new Error("Not implemented on web.")),
      }),
    },
  ],
});

// A reader that answers later, as the native ones do.
testRunningReader({
  name: "a reader that answers later",
  create: () => {
    const { reader, reads } = createBuildReader({ id: "113" });

    return { reader: async () => reader(), reads };
  },
});

// A reader over a constant has no host to ask, and no count to give.
testRunningReader({
  name: "a reader over a constant",
  create: () => ({
    reader: () => ({
      identity: {
        status: "known",
        authority: "com.example.notes",
        domain: "web-artifact",
        value: "build-a",
      },
      label: null,
      raw: {},
    }),
  }),
});
