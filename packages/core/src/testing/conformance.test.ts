import { createMockSource } from "src/mock/createMockSource";
import { testReleaseDriver } from "src/testing/testReleaseDriver";
import { testReleaseSource } from "src/testing/testReleaseSource";
import { testUpdateMechanism } from "src/testing/testUpdateMechanism";
import { testVersionStrategy } from "src/testing/testVersionStrategy";
import { createHeldMechanism } from "src/utils/commands.fixture";
import { createReleaseDriver } from "src/utils/createReleaseDriver";
import { createReleaseSource } from "src/utils/createReleaseSource";
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

testUpdateMechanism({
  name: "held",
  create: () => {
    const opened = { count: 0 };
    const { mechanism } = createHeldMechanism();

    return {
      mechanism: {
        ...mechanism,
        open: () => {
          opened.count += 1;

          return mechanism.open();
        },
      },
      opens: () => opened.count,
    };
  },
});

// A provider SDK that reports its changes to whoever listens.
const createFakeProvider = () => {
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

testReleaseDriver({
  name: "fake provider",
  create: () => {
    const provider = createFakeProvider();

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
