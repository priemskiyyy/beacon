import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import {
  createMockJournalStorage,
  createMockSource,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import type {
  JournalOptions,
  NoneDecision,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { browserReload } from "src/browserReload";
import { fakeWindow, SCOPE } from "src/fakeWindow.fixture";

const target = (value: string): TargetDecision => ({
  kind: "target",
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "web-artifact",
      value,
    },
    label: `Build ${value}`,
  },
});

const createWebBeacon = (
  window = fakeWindow(),
  journal: JournalOptions | undefined = undefined,
) => {
  const mock = createMockSource<{ web: TargetDecision | NoneDecision }>({
    name: "manifest",
  });

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: browserReload({ target: window }),
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: () => ({
        identity: target("web-build-b").release.identity,
        label: "Build web-build-b",
        raw: {},
      }),
    },
    routes: { web },
    clock: createTestClock({ now: 1_000 }),
    ...(journal === undefined ? {} : { journal }),
  });

  mock.answer({ document: { web: target("web-build-a") }, expiresAt: 601_000 });

  return { beacon, window };
};

const startWithOffer = async ({
  beacon,
}: ReturnType<typeof createWebBeacon>) => {
  beacon.start();
  await beacon.route("web").check();

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  return observation.offer.ref;
};

test("WEB-12 creating the mechanism and the beacon touch the window not at all", () => {
  const { window } = createWebBeacon();

  expect(window.locationReads()).toBe(0);
});

test("WEB-01 an accepted reload proves only the request, and the running build stays", async () => {
  const context = createWebBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  await expect(web.reload({ offer })).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: { kind: "reload-requested" },
  });
  expect(context.window.reloads()).toBe(1);
  expect(context.beacon.running.get().web).toMatchObject({
    state: "known",
    release: { label: "Build web-build-b" },
  });
});

test("WEB-01 the reload is a document replacement bound to nothing", () => {
  const { beacon } = createWebBeacon();

  expect(beacon.route("web").capabilities.reload).toEqual({
    reference: "offer",
    impacts: ["document-replacement"],
    binding: "unpinned-navigation",
  });
});

test("WEB-02 a reload the browser refuses fails, and the route accepts commands again", async () => {
  const context = createWebBeacon(fakeWindow({ failsToReload: true }));
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  await expect(web.reload({ offer })).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("a reload that was accepted holds the route until the application acknowledges", async () => {
  const context = createWebBeacon();
  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  await web.reload({ offer });

  expect(web.state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "dispatch-unconfirmed",
  });

  web.acknowledge();

  expect(web.state.get().operation).toEqual({ state: "idle" });
});

test("the native handle of the route is the window while a session runs", () => {
  const { beacon, window } = createWebBeacon();
  const web = beacon.route("web");

  beacon.start();
  expect(web.native.get()).toEqual({ window });

  beacon.stop();
  expect(web.native.get()).toBeNull();
});

test("without a window a reload is unsupported, and nothing is claimed", async () => {
  const mock = createMockSource<{ web: TargetDecision | NoneDecision }>({
    name: "manifest",
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: () => ({
        identity: target("web-build-b").release.identity,
        label: "Build web-build-b",
        raw: {},
      }),
    },
    routes: {
      web: targetRoute({
        subject: "web",
        source: mock.source.select((manifest) => manifest.web),
        mechanism: browserReload(),
      }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  mock.answer({ document: { web: target("web-build-a") }, expiresAt: 601_000 });

  const offer = await startWithOffer({ beacon, window: fakeWindow() });

  await expect(beacon.route("web").reload({ offer })).resolves.toEqual({
    status: "unsupported",
    reason: "no-document",
  });
  expect(beacon.route("web").state.get().operation).toEqual({ state: "idle" });
});

test("WEB-06 the intent is persisted before the reload is dispatched, never after it", async () => {
  const storage = createMockJournalStorage();
  const context = createWebBeacon(fakeWindow(), { mode: "required", storage });
  const offer = await startWithOffer(context);

  storage.holdWrites();

  const pending = context.beacon.route("web").reload({ offer });

  await settle();

  expect(storage.writes()).toBe(1);
  expect(context.window.reloads()).toBe(0);

  storage.releaseWrites();

  await expect(pending).resolves.toMatchObject({ status: "accepted" });
  expect(context.window.reloads()).toBe(1);
});

test("WEB-11 without a journal the limitation is visible and a reload still proceeds", async () => {
  const context = createWebBeacon();
  const offer = await startWithOffer(context);

  expect(context.beacon.transitions.get().journal).toBe("off");

  await expect(
    context.beacon.route("web").reload({ offer }),
  ).resolves.toMatchObject({ status: "accepted" });
});

test("WEB-11 a required journal that cannot persist blocks the reload", async () => {
  const storage = createMockJournalStorage();
  const context = createWebBeacon(fakeWindow(), { mode: "required", storage });
  const offer = await startWithOffer(context);

  storage.failWrites();

  await expect(
    context.beacon.route("web").reload({ offer }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "JOURNAL_FAILED" },
  });
  expect(context.window.reloads()).toBe(0);
});

test("WEB-10 a document restored from the back-forward cache is the same boot, and starting the session again reports no update boot", async () => {
  const storage = createMockJournalStorage();

  const context = createWebBeacon(fakeWindow(), {
    mode: "best-effort",
    storage,
  });

  const offer = await startWithOffer(context);
  const web = context.beacon.route("web");

  await web.reload({ offer });

  // The reload was requested, but the page was kept and shown again: nothing booted.
  web.acknowledge();
  context.beacon.stop();
  context.beacon.start();
  await settle();

  expect(context.beacon.transitions.get().latest).toMatchObject({
    intent: { boot: { id: "boot-1" } },
    outcome: "same-boot",
  });
  expect(context.beacon.running.get().web).toMatchObject({
    release: { label: "Build web-build-b" },
  });
});
