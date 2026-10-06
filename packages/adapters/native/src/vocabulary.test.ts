import { Beacon } from "@priemskiyyy/beacon";
import {
  createMockJournalStorage,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import { appleMarketingVersion } from "@priemskiyyy/beacon-app-store";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";
import { expect, test } from "vitest";

import { expoApplication } from "src/expoApplication";
import { fakeApplication, SCOPE } from "src/fakeApplication.fixture";
import type { ExpoApplicationOptions } from "src/types/ExpoApplicationOptions";

// The adapters cannot import each other, so the words this package writes are held to the words the store adapters read and offer by running them together.

const createBridge = (versionCode: number): PlayBridge => ({
  getUpdateInfo: async () => ({
    availability: "available",
    versionCode,
    flexible: true,
    immediate: true,
    priority: 2,
    stalenessDays: 5,
    installStatus: "unknown",
  }),
  startFlexible: async () => "started",
  startImmediate: async () => "started",
  completeUpdate: async () => {},
  addInstallListener: () => () => {},
});

const bootWith = (
  { build, boot, offered }: { build: string; boot: string; offered: number },
  storage: ReturnType<typeof createMockJournalStorage>,
  options: Pick<ExpoApplicationOptions, "domain"> = {},
) => {
  const { application } = fakeApplication({ build });

  return new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: boot },
      native: expoApplication({ application, ...options }),
    },
    routes: { binary: googlePlay({ bridge: createBridge(offered) }) },
    journal: { mode: "required", storage },
    clock: createTestClock({ now: 1_000 }),
  });
};

// Boot one runs build 112 and is offered 113; the immediate flow is started; boot two runs what the reader says.
const updateAndBootAgain = async (
  next: { build: string },
  options: Pick<ExpoApplicationOptions, "domain"> = {},
) => {
  const storage = createMockJournalStorage();

  const first = bootWith(
    { build: "112", boot: "boot-1", offered: 113 },
    storage,
    options,
  );

  first.start();
  await first.check();

  const { observation } = first.route("binary").state.get();

  if (observation.status !== "available") {
    throw new Error("The binary route has no offer.");
  }

  const outcome = await first
    .route("binary")
    .update({ offer: observation.offer.ref });

  expect(outcome.status).toBe("accepted");

  const second = bootWith(
    { ...next, boot: "boot-2", offered: 113 },
    storage,
    options,
  );

  second.start();
  await settle();

  return second.transitions.get();
};

test("a build the Play route offered is named the same way when it runs, so the journal says the update ran", async () => {
  const transitions = await updateAndBootAgain({ build: "113" });

  expect(transitions.latest).toMatchObject({
    outcome: "target-running",
    attempts: 0,
  });
});

test("an old build still running after the update was accepted is not the target", async () => {
  const transitions = await updateAndBootAgain({ build: "112" });

  expect(transitions.latest).toMatchObject({ outcome: "target-not-running" });
});

test("a reader in another domain than the Play route leaves the journal unable to say, which is what the shared word prevents", async () => {
  const transitions = await updateAndBootAgain(
    { build: "113" },
    { domain: "native-android-build" },
  );

  expect(transitions.latest).toMatchObject({ outcome: "inconclusive" });
});

test("a build nobody read leaves the journal unable to say, never an old build", async () => {
  const transitions = await updateAndBootAgain({ build: "" });

  expect(transitions.latest).toMatchObject({ outcome: "inconclusive" });
});

test("the marketing version an iOS binary reports is the fact the App Store adapter reads as the order of what runs", async () => {
  const { application } = fakeApplication({ version: "2.5.0" });

  const release = await expoApplication({ application })({
    scope: { ...SCOPE, platform: "ios" },
  });

  expect(appleMarketingVersion(release)).toBe("2.5.0");
});

test("a binary that gave no marketing version has no order for the App Store adapter", async () => {
  const { application } = fakeApplication({ version: null });

  const release = await expoApplication({ application })({
    scope: { ...SCOPE, platform: "ios" },
  });

  expect(appleMarketingVersion(release)).toBeNull();
});
