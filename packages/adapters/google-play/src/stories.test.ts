import { Beacon, minimumBuild } from "@priemskiyyy/beacon";
import {
  createMockSource,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import type { ReleaseScope } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { downloading, installEvent } from "src/fakeBridge.fixture";
import { googlePlay } from "src/googlePlay";
import { playStore } from "src/playStore";
import type { PlayBridge } from "src/types/PlayBridge";
import type { PlayInstallEvent } from "src/types/PlayInstallEvent";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";

// The stories play the specification's end-to-end cases with the public API of the core and this package: a native device whose state outlives a process, a bridge over it, and what a minimum build asks.

const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "android",
  distribution: "google-play",
};

// What Play holds on the device. A process that dies takes its bridge and its listeners with it, and the download goes on.
const createDevice = () => {
  const device: {
    phase: "idle" | "downloading" | "downloaded";
    starts: number;
    completions: number;
    listeners: Set<(event: PlayInstallEvent) => void>;
  } = {
    phase: "idle",
    starts: 0,
    completions: 0,
    listeners: new Set<(event: PlayInstallEvent) => void>(),
  };

  const info = (): PlayUpdateInfo => ({
    availability: "available",
    versionCode: 412,
    flexible: true,
    immediate: true,
    priority: 2,
    stalenessDays: 5,
    installStatus: device.phase === "idle" ? "unknown" : device.phase,
  });

  // A new process has a new bridge object over the same native manager.
  const openBridge = (): PlayBridge => {
    const mine = new Set<(event: PlayInstallEvent) => void>();

    return {
      getUpdateInfo: async () => info(),
      startFlexible: async () => {
        device.starts += 1;
        device.phase = "downloading";

        return "started";
      },
      startImmediate: async () => "started",
      completeUpdate: async () => {
        device.completions += 1;
      },
      addInstallListener: (listener) => {
        mine.add(listener);
        device.listeners.add(listener);

        return () => {
          mine.delete(listener);
          device.listeners.delete(listener);
        };
      },
    };
  };

  return {
    device,
    openBridge,
    emit: (event: PlayInstallEvent) => {
      device.phase =
        event.status === "downloaded" ? "downloaded" : "downloading";

      for (const listener of [...device.listeners]) {
        listener(event);
      }
    },
    // The process is gone: nothing is delivered to it, and nothing is cleaned up.
    kill: () => {
      device.listeners.clear();
    },
  };
};

const boot = (bridge: PlayBridge, id: string) =>
  new Beacon({
    scope: SCOPE,
    running: { boot: { id } },
    routes: { binary: googlePlay({ bridge }) },
    clock: createTestClock({ now: 1_000 }),
  });

test("Story E a flexible download interrupted by process death is found by the next start, which replays no start and completes only when asked", async () => {
  const native = createDevice();
  const first = boot(native.openBridge(), "boot-1");

  first.start();
  await first.check();

  const offered = first.route("binary").state.get().observation;

  if (offered.status !== "available") {
    throw new Error("The binary route has no offer.");
  }

  // The user consents and the download begins. The process dies before the completion callback, so that promise never settles.
  const starting = first.route("binary").download({ offer: offered.offer });

  await settle();
  native.emit(downloading(1_024, 4_096));
  expect(first.route("binary").state.get().operation).toMatchObject({
    state: "running",
    command: "download",
  });
  expect(native.device.starts).toBe(1);
  native.kill();

  // The next start has a new Beacon over a new bridge, and queries the native state.
  const second = boot(native.openBridge(), "boot-2");

  second.start();
  await settle();

  const binary = second.route("binary");

  // The old command left nothing behind to replay: this one runs no operation, prepares nothing and started no flow.
  expect(binary.state.get().operation).toEqual({ state: "idle" });
  expect(binary.state.get().prepared).toEqual({ status: "unknown" });
  expect(native.device.starts).toBe(1);
  expect(binary.state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { identity: { value: "412" } } },
  });

  // Play finishes the download while the new process runs: it is prepared under a reference of this session, and nothing completes by itself.
  native.emit(installEvent("downloaded"));

  const { prepared } = binary.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The binary route has nothing prepared.");
  }

  expect(native.device.completions).toBe(0);
  expect(native.device.starts).toBe(1);

  await expect(
    binary.restart({ prepared: prepared.value }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "completion-requested" },
  });
  expect(native.device.completions).toBe(1);

  // The first process's promise is still pending: nothing ever answered it, and it was never taken for a cancellation.
  const settled = await Promise.race([
    starting,
    settle().then(() => "pending"),
  ]);

  expect(settled).toBe("pending");
});

test("Story E a download still under way when the next start queries Play is the offer it was, and no progress is made up for a download this session did not start", async () => {
  const native = createDevice();
  const first = boot(native.openBridge(), "boot-1");

  first.start();
  await first.check();

  const offered = first.route("binary").state.get().observation;

  if (offered.status !== "available") {
    throw new Error("The binary route has no offer.");
  }

  const starting = first.route("binary").download({ offer: offered.offer });

  await settle();
  native.kill();

  const second = boot(native.openBridge(), "boot-2");

  second.start();
  await settle();
  native.emit(downloading(2_048, 4_096));

  // The operation slot belongs to the commands of this session, so Play's progress for a transfer the dead process started has nowhere to be shown, and none is invented.
  const state = second.route("binary").state.get();

  expect(state.operation).toEqual({ state: "idle" });
  expect(state.prepared).toEqual({ status: "unknown" });
  expect(state.observation).toMatchObject({
    status: "available",
    offer: { release: { identity: { value: "412" } } },
  });
  expect(native.device.starts).toBe(1);
  expect(await Promise.race([starting, settle().then(() => "pending")])).toBe(
    "pending",
  );
});

// Story G lives below: a policy that needs a newer binary when no store action is usable.
test("Story G an unsupported app with no eligible store update shows unsupported with no usable remediation, and dispatches nothing", async () => {
  const manifest = createMockSource<{ minimumBuild: number }>({
    name: "minimum",
  });

  manifest.answer({ document: { minimumBuild: 108 } });

  const opened: string[] = [];

  const bridge: PlayBridge = {
    getUpdateInfo: async () => ({ availability: "unknown" }),
    startFlexible: async () => {
      opened.push("flexible");

      return "failed";
    },
    startImmediate: async () => {
      opened.push("immediate");

      return "failed";
    },
    completeUpdate: async () => {
      opened.push("completion");
    },
    addInstallListener: () => () => {},
  };

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      native: ({ scope }) => ({
        identity: {
          status: "known",
          authority: scope.application,
          domain: "android-version-code",
          value: "104",
        },
        label: "104",
        raw: {},
      }),
    },
    routes: { binary: googlePlay({ bridge }) },
    policy: minimumBuild({
      source: manifest.source.select((document) => document.minimumBuild),
      remediation: "binary",
    }),
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();
  await beacon.check();

  // Play cannot say (no Play services, or an ineligible setup): that is not "no update", and the policy is unmet.
  expect(beacon.route("binary").state.get().observation).toEqual({
    status: "unknown",
    reason: "unsupported-environment",
  });
  expect(beacon.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: {
      reasons: [{ code: "native-build-too-old" }],
      remediation: [{ route: "binary", level: "required", usable: false }],
    },
  });

  // Retrying is a check and nothing else: no flow, no store page, no redirect.
  await beacon.check({ reason: "manual" });
  expect(beacon.support.get()).toMatchObject({ status: "unsupported" });
  expect(opened).toEqual([]);
});

test("Story G a failed read of the minimum is a read failure of the policy and not a verdict, and is kept apart from what Play says", async () => {
  const manifest = createMockSource<{ minimumBuild: number }>({
    name: "minimum",
  });

  manifest.hold();

  const bridge: PlayBridge = {
    getUpdateInfo: async () => ({ availability: "not-available" }),
    startFlexible: async () => "failed",
    startImmediate: async () => "failed",
    completeUpdate: async () => {},
    addInstallListener: () => () => {},
  };

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      native: ({ scope }) => ({
        identity: {
          status: "known",
          authority: scope.application,
          domain: "android-version-code",
          value: "104",
        },
        label: "104",
        raw: {},
      }),
    },
    routes: { binary: googlePlay({ bridge }) },
    policy: minimumBuild({
      source: manifest.source.select((document) => document.minimumBuild),
      remediation: "binary",
    }),
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();

  const pending = beacon.check();

  await settle();
  manifest.reject(new Error("the release endpoint is down"));

  const report = await pending;

  expect(report.support).toMatchObject({ status: "failed" });
  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "read-failed",
  });
  expect(beacon.route("binary").state.get().observation).toMatchObject({
    status: "none",
    detail: "not-available",
  });
});

test("Story G a store page that belongs to another distribution is unusable, and the handoff opens nothing", async () => {
  const opened: string[] = [];

  const beacon = new Beacon({
    scope: { ...SCOPE, distribution: "internal-testing" },
    routes: {
      store: playStore({
        applicationId: SCOPE.application,
        linking: {
          openURL: async (url) => {
            opened.push(url);
          },
        },
      }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  beacon.start();

  await expect(beacon.route("store").openStore()).resolves.toEqual({
    status: "unsupported",
    reason: "other-distribution",
  });
  expect(opened).toEqual([]);
});
