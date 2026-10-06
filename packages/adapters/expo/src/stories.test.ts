import { Beacon, minimumBuild } from "@priemskiyyy/beacon";
import {
  createMockJournalStorage,
  createMockSource,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import type {
  PlayBridge,
  PlayUpdateInfo,
} from "@priemskiyyy/beacon-google-play";
import { expect, test } from "vitest";

import { expoApplication } from "src/expoApplication";
import { expoUpdates } from "src/expoUpdates";
import { fakeApplication, SCOPE } from "src/fakeApplication.fixture";
import {
  available,
  fakeUpdates,
  fetchedNew,
  fetchedRollback,
  rollbackCheck,
  UPDATE_A,
  UPDATE_B,
} from "src/fakeUpdates.fixture";

// The stories play the specification's end-to-end cases with the public API of the core, this package and the Play adapter: a minimum build a source names, a binary reader, `expo-updates` and a Play bridge, each a fake the test scripts.

const OTA_X = "5d1e8a30-7c4b-4f29-8e61-0b3a9c2d4f17";

const createBridge = (info: PlayUpdateInfo): PlayBridge => ({
  getUpdateInfo: async () => info,
  startFlexible: async () => "started",
  startImmediate: async () => "started",
  completeUpdate: async () => {},
  addInstallListener: () => () => {},
});

const playOffering = (versionCode: number): PlayUpdateInfo => ({
  availability: "available",
  versionCode,
  flexible: true,
  immediate: true,
  priority: 2,
  stalenessDays: 5,
  installStatus: "unknown",
});

type Boot = {
  id: string;
  nativeBuild: string;
  updateId: string;
  minimum: number;
  offered: PlayUpdateInfo;
};

// One boot of an Android app that has an OTA route over `expo-updates` and a binary route over Play, under a minimum build the application's own source names.
const boot = (
  { id, nativeBuild, updateId, minimum, offered }: Boot,
  storage = createMockJournalStorage(),
) => {
  const updates = fakeUpdates({ updateId, isEmbeddedLaunch: false });
  const application = fakeApplication({ build: nativeBuild });

  const manifest = createMockSource<{ minimumBuild: number }>({
    name: "minimum",
  });

  manifest.answer({ document: { minimumBuild: minimum } });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id },
      native: expoApplication({ application: application.application }),
    },
    routes: {
      ota: expoUpdates({ updates: updates.updates }),
      binary: googlePlay({ bridge: createBridge(offered) }),
    },
    policy: minimumBuild({
      source: manifest.source.select((document) => document.minimumBuild),
      remediation: "binary",
    }),
    journal: { mode: "required", storage },
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, updates, manifest, storage };
};

test("Story B an OTA hotfix and a required native update coexist, and only a native build that meets the minimum lifts the requirement", async () => {
  const first = boot({
    id: "boot-1",
    nativeBuild: "104",
    updateId: OTA_X,
    minimum: 108,
    offered: playOffering(112),
  });

  first.updates.willCheck(available(UPDATE_B));
  first.updates.willFetch(fetchedNew(UPDATE_B));
  first.beacon.start();
  await first.beacon.check({ reason: "startup" });

  const ota = first.beacon.route("ota");
  const binary = first.beacon.route("binary");

  // Both offers are visible at once: OTA update Y, and native build 112.
  expect(ota.state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { identity: { value: UPDATE_B } } },
  });
  expect(binary.state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { identity: { value: "112" } } },
  });

  // Build 104 is under the minimum 108, and the binary route is how to satisfy it.
  expect(first.beacon.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: {
      reasons: [{ code: "native-build-too-old", subject: "native" }],
      remediation: [{ route: "binary", level: "required", usable: true }],
    },
  });

  // Downloading prepares what the provider chose, and the requirement stays unmet by it.
  const otaOffer = ota.state.get().observation;

  if (otaOffer.status !== "available") {
    throw new Error("The OTA route has no offer.");
  }

  await expect(ota.download({ offer: otaOffer.offer })).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "update-prepared", update: { id: UPDATE_B } },
  });
  expect(ota.state.get().prepared).toMatchObject({
    status: "ready",
    value: { release: { identity: { value: UPDATE_B } } },
  });
  expect(first.beacon.support.get()).toMatchObject({ status: "unsupported" });
  expect(binary.state.get().observation.status).toBe("available");

  // The native flow is started, which is Play taking over, and not a build that runs: the requirement stays unmet.
  const binaryOffer = binary.state.get().observation;

  if (binaryOffer.status !== "available") {
    throw new Error("The binary route has no offer.");
  }

  await expect(
    binary.update({ offer: binaryOffer.offer }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "immediate-flow-started" },
  });
  expect(first.beacon.support.get()).toMatchObject({ status: "unsupported" });
  expect(first.beacon.running.get().native).toMatchObject({
    release: { identity: { value: "104" } },
  });

  // A later OTA boot runs Y, and the native build is still 104.
  const second = boot(
    {
      id: "boot-2",
      nativeBuild: "104",
      updateId: UPDATE_B,
      minimum: 108,
      offered: playOffering(112),
    },
    first.storage,
  );

  second.beacon.start();
  await second.beacon.check();
  expect(second.beacon.running.get().bundle).toMatchObject({
    release: { identity: { value: UPDATE_B } },
  });
  expect(second.beacon.support.get()).toMatchObject({ status: "unsupported" });
  expect(second.beacon.route("binary").state.get().observation.status).toBe(
    "available",
  );

  // The next boot after the native flow still runs build 104, so the journal says the target was not reached.
  expect(second.beacon.transitions.get().latest).toMatchObject({
    intent: { route: "binary", command: "update", boot: { id: "boot-1" } },
    outcome: "target-not-running",
  });

  // Only a native build that meets the minimum, or a new policy, lifts it.
  const third = boot(
    {
      id: "boot-3",
      nativeBuild: "112",
      updateId: UPDATE_B,
      minimum: 108,
      offered: { availability: "not-available" },
    },
    first.storage,
  );

  third.beacon.start();
  await third.beacon.check();
  expect(third.beacon.support.get()).toMatchObject({ status: "supported" });

  const lowered = boot({
    id: "boot-4",
    nativeBuild: "104",
    updateId: UPDATE_B,
    minimum: 100,
    offered: playOffering(112),
  });

  lowered.beacon.start();
  await lowered.beacon.check();
  expect(lowered.beacon.support.get()).toMatchObject({ status: "supported" });
});

test("Story C a deployment that changes between the check and the download is reported as different, and a reference to the first is no prepared target", async () => {
  const context = boot({
    id: "boot-1",
    nativeBuild: "108",
    updateId: OTA_X,
    minimum: 100,
    offered: { availability: "not-available" },
  });

  context.updates.willCheck(available(UPDATE_A));
  context.beacon.start();
  await context.beacon.check();

  const ota = context.beacon.route("ota");
  const shown = ota.state.get().observation;

  if (shown.status !== "available") {
    throw new Error("The OTA route has no offer.");
  }

  // The user was shown A. Before the download the deployment moved to B, and the provider fetches its own current selection.
  context.updates.willFetch(fetchedNew(UPDATE_B));

  const download = await ota.download({ offer: shown.offer });

  expect(download).toMatchObject({
    status: "accepted",
    receipt: {
      kind: "update-prepared",
      update: { id: UPDATE_B },
      offered: "different",
    },
  });

  const { prepared } = ota.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The OTA route has nothing prepared.");
  }

  expect(prepared.value).toMatchObject({
    release: { identity: { value: UPDATE_B } },
  });

  // What the user was shown is not what is prepared: its offer is no prepared reference, and a reload asked with it is refused.
  // @ts-expect-error a reload takes the prepared target, and an offer is another kind of reference
  const refused = await ota.reload({ prepared: shown.offer });

  expect(refused).toMatchObject({ status: "stale" });
  expect(context.updates.calls.reloads).toBe(0);

  // With the new target on screen the application asks the user again, and then the reload goes through the prepared reference of B.
  await expect(ota.reload({ prepared: prepared.value })).resolves.toMatchObject(
    {
      status: "accepted",
      receipt: { kind: "reload-requested" },
    },
  );
  expect(context.updates.calls.reloads).toBe(1);
});

test("Story C a deployment that becomes an embedded rollback is prepared as one, which names no update to compare with what was shown", async () => {
  const context = boot({
    id: "boot-1",
    nativeBuild: "108",
    updateId: OTA_X,
    minimum: 100,
    offered: { availability: "not-available" },
  });

  context.updates.willCheck(available(UPDATE_A));
  context.beacon.start();
  await context.beacon.check();

  const ota = context.beacon.route("ota");
  const shown = ota.state.get().observation;

  if (shown.status !== "available") {
    throw new Error("The OTA route has no offer.");
  }

  context.updates.willFetch(fetchedRollback());

  await expect(ota.download({ offer: shown.offer })).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "rollback-prepared", offered: "unknown" },
  });
  expect(ota.state.get().prepared).toMatchObject({
    status: "ready",
    value: { kind: "rollback-to-embedded" },
  });
});

test("Story D a downloaded update survives a check that fails offline, and can still be activated", async () => {
  const context = boot({
    id: "boot-1",
    nativeBuild: "108",
    updateId: OTA_X,
    minimum: 100,
    offered: { availability: "not-available" },
  });

  context.updates.willCheck(available(UPDATE_A));
  context.updates.willFetch(fetchedNew(UPDATE_A));
  context.beacon.start();
  await context.beacon.check();

  const ota = context.beacon.route("ota");
  const shown = ota.state.get().observation;

  if (shown.status !== "available") {
    throw new Error("The OTA route has no offer.");
  }

  await ota.download({ offer: shown.offer });

  const before = ota.state.get();

  // The next check meets no network.
  context.updates.willCheck(new Error("offline"));

  const outcome = await ota.check();
  const after = ota.state.get();

  expect(outcome).toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });
  expect(after.check).toMatchObject({ state: "failed" });

  // The last offer is the one that was seen, with the evidence of when, and the failed check renewed nothing of it.
  expect(after.observation).toMatchObject({
    status: "available",
    offer: { release: { identity: { value: UPDATE_A } } },
  });
  expect(after.observation).toBe(before.observation);

  // Neither "no update" nor "the download failed" was invented, and what the provider prepared is as it was.
  expect(after.observation.status).not.toBe("none");
  expect(after.operation).toEqual({ state: "idle" });
  expect(after.prepared).toBe(before.prepared);

  if (after.prepared.status !== "ready") {
    throw new Error("The OTA route has nothing prepared.");
  }

  // So an activation that needs no network is still on offer.
  await expect(
    ota.reload({ prepared: after.prepared.value }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
  expect(context.updates.calls.reloads).toBe(1);
  await settle();
});

test("Story D a rollback the provider prepared survives the failed check too", async () => {
  const context = boot({
    id: "boot-1",
    nativeBuild: "108",
    updateId: OTA_X,
    minimum: 100,
    offered: { availability: "not-available" },
  });

  context.updates.willCheck(rollbackCheck());
  context.updates.willFetch(fetchedRollback());
  context.beacon.start();
  await context.beacon.check();

  const ota = context.beacon.route("ota");
  const shown = ota.state.get().observation;

  if (shown.status !== "available") {
    throw new Error("The OTA route has no offer.");
  }

  await ota.download({ offer: shown.offer });

  const { prepared } = ota.state.get();

  context.updates.willCheck(new Error("offline"));
  await ota.check();

  expect(ota.state.get().prepared).toBe(prepared);
  expect(ota.state.get().observation).toMatchObject({ status: "available" });
});
