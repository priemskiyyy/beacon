import type { RunningApplication } from "@priemskiyyy/beacon";
import { createMockJournalStorage, settle } from "@priemskiyyy/beacon/mock";
import type { UpdatesLike } from "@priemskiyyy/beacon-expo";
import { expect, test } from "vitest";

import { createNativeBeacon } from "src/lab/createNativeBeacon";
import { evaluateNativeSupport } from "src/lab/evaluateNativeSupport";

const EMBEDDED = "00000000-0000-4000-8000-000000000001";
const NEXT = "3f9a7d20-51c4-4b6e-8a02-c1d4e9b7f356";

// An `expo-updates` module whose answers are fixed and whose calls are counted.
const fakeUpdates = (isEnabled: boolean, running = EMBEDDED) => {
  const calls = { fetches: 0, reloads: 0 };

  const updates: UpdatesLike = {
    isEnabled,
    updateId: isEnabled ? running : null,
    channel: null,
    runtimeVersion: "1",
    isEmbeddedLaunch: true,
    isEmergencyLaunch: false,
    checkForUpdateAsync: async () => ({
      isAvailable: true,
      isRollBackToEmbedded: false,
      manifest: { id: NEXT },
      reason: undefined,
    }),
    fetchUpdateAsync: async () => {
      calls.fetches += 1;

      return {
        isNew: true,
        isRollBackToEmbedded: false,
        manifest: { id: NEXT },
      };
    },
    reloadAsync: async () => {
      calls.reloads += 1;
    },
  };

  return { updates, calls };
};

test("a device without updates enabled cannot check, and Beacon says so instead of saying nothing is on offer", async () => {
  const { updates } = fakeUpdates(false);

  const beacon = createNativeBeacon({
    updates,
    platform: "ios",
    boot: { id: "boot-1" },
  });

  beacon.start();
  await beacon.check({ reason: "startup" });

  expect(beacon.route("ota").state.get().observation).toEqual({
    status: "unknown",
    reason: "unsupported-environment",
  });
  expect(beacon.running.get().bundle).toMatchObject({ state: "known" });
  expect(beacon.support.get().status).toBe("unknown");
  beacon.dispose();
});

test("an update is offered, downloaded on request, and a reload asks for the prepared one without claiming it runs", async () => {
  const { updates, calls } = fakeUpdates(true);

  const beacon = createNativeBeacon({
    updates,
    platform: "android",
    boot: { id: "boot-1" },
  });

  const ota = beacon.route("ota");

  beacon.start();
  await beacon.check({ reason: "startup" });
  await settle();

  const { observation } = ota.state.get();

  if (observation.status !== "available") {
    throw new Error(`Nothing is on offer: ${observation.status}.`);
  }

  await expect(
    ota.download({ offer: observation.offer.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "update-prepared", offered: "same" },
  });

  const { prepared } = ota.state.get();

  if (prepared.status !== "ready") {
    throw new Error(`Nothing is prepared: ${prepared.status}.`);
  }

  await expect(
    ota.reload({ prepared: prepared.value.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
  expect(calls).toEqual({ fetches: 1, reloads: 1 });
  expect(beacon.running.get().bundle).toMatchObject({
    state: "known",
    release: { identity: { value: EMBEDDED } },
  });
  expect(beacon.support.get().status).toBe("supported");
  beacon.dispose();
});

test("an update the backend ended is unsupported and the OTA route is the way out", () => {
  const running: RunningApplication = {
    boot: { id: "boot-1" },
    revision: 1,
    native: { state: "unconfigured" },
    bundle: {
      state: "known",
      readAt: 1,
      release: {
        identity: {
          status: "known",
          authority: "expo-updates",
          domain: "update",
          value: EMBEDDED,
        },
        label: null,
        raw: {},
      },
    },
    web: { state: "unconfigured" },
    worker: { state: "unconfigured" },
  };

  expect(evaluateNativeSupport({ endedUpdates: [EMBEDDED] }, running)).toEqual({
    status: "unsupported",
    reasons: [{ code: "update-ended", subject: "bundle" }],
    remediation: [{ route: "ota", level: "required" }],
  });
  expect(evaluateNativeSupport({ endedUpdates: [] }, running).status).toBe(
    "supported",
  );
});

test("a reload writes its intent to the journal, and the next boot says it reached the update it asked for", async () => {
  const journal = createMockJournalStorage();
  const { updates } = fakeUpdates(true);

  const beacon = createNativeBeacon({
    updates,
    platform: "android",
    boot: { id: "boot-1" },
    journal,
  });

  const ota = beacon.route("ota");

  beacon.start();
  await beacon.check({ reason: "startup" });
  await settle();

  const { observation } = ota.state.get();

  if (observation.status !== "available") {
    throw new Error(`Nothing is on offer: ${observation.status}.`);
  }

  await ota.download({ offer: observation.offer.ref });

  const { prepared } = ota.state.get();

  if (prepared.status !== "ready") {
    throw new Error(`Nothing is prepared: ${prepared.status}.`);
  }

  await ota.reload({ prepared: prepared.value.ref });

  expect(journal.records.size).toBe(1);
  beacon.dispose();

  // The JavaScript runtime was replaced: a new Beacon, the same storage, and the update now runs.
  const next = createNativeBeacon({
    updates: fakeUpdates(true, NEXT).updates,
    platform: "android",
    boot: { id: "boot-2" },
    journal,
  });

  next.start();
  await settle();

  expect(next.transitions.get().latest).toMatchObject({
    outcome: "target-running",
    attempts: 0,
    exhausted: false,
  });
  next.dispose();
});

test("without a journal, a reload leaves nothing to correlate, and the Beacon says it is off", async () => {
  const { updates } = fakeUpdates(true);

  const beacon = createNativeBeacon({
    updates,
    platform: "ios",
    boot: { id: "boot-1" },
  });

  beacon.start();
  await settle();

  expect(beacon.transitions.get()).toMatchObject({
    journal: "off",
    latest: null,
  });
  beacon.dispose();
});

test("the native build is read beside the bundle, and a binary of another application is unknown", async () => {
  const { updates } = fakeUpdates(true);

  const build = (applicationId: string) => ({
    applicationId,
    nativeApplicationVersion: "2.4.0",
    nativeBuildVersion: "108",
  });

  const own = createNativeBeacon({
    updates,
    platform: "android",
    boot: { id: "boot-1" },
    application: build("dev.beacon.example"),
  });

  own.start();
  await settle();

  expect(own.running.get().native).toMatchObject({
    state: "known",
    release: {
      identity: {
        authority: "dev.beacon.example",
        domain: "android-version-code",
        value: "108",
      },
    },
  });
  own.dispose();

  const expoGo = createNativeBeacon({
    updates,
    platform: "ios",
    boot: { id: "boot-1" },
    application: build("host.exp.Exponent"),
  });

  expoGo.start();
  await settle();

  expect(expoGo.running.get().native).toMatchObject({
    state: "known",
    release: { identity: { status: "unknown", reason: "another-application" } },
  });
  expoGo.dispose();
});
