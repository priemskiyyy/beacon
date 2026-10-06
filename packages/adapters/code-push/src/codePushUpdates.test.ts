import { Beacon, compareIdentities } from "@priemskiyyy/beacon";
import type { RunningReaders, RunningRelease } from "@priemskiyyy/beacon";
import {
  createMockJournalStorage,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { codePushBundle } from "src/codePushBundle";
import { codePushUpdates } from "src/codePushUpdates";
import {
  fakeCodePush,
  HASH_A,
  HASH_B,
  localPackage,
  SCOPE,
} from "src/fakeCodePush.fixture";

type Options = {
  // The route reads the running bundle from CodePush too, so a test that watches the route's own reads passes a reader that reads nothing.
  bundle?: boolean;
};

const create = ({ bundle = true }: Options = {}) => {
  const fake = fakeCodePush();
  const clock = createTestClock({ now: 1_000 });

  const beacon = new Beacon({
    scope: SCOPE,
    running: bundle ? {} : { bundle: () => NOT_READ },
    routes: { update: codePushUpdates({ codePush: fake.codePush }) },
    clock,
  });

  return { ...fake, beacon, clock, update: beacon.route("update") };
};

type Context = ReturnType<typeof create>;

const NOT_READ: RunningRelease = {
  identity: { status: "unknown", reason: "not-read" },
  label: null,
  raw: {},
};

const checkOffer = async (context: Context) => {
  context.beacon.start();
  await context.update.check();

  const { observation } = context.update.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  return observation.offer;
};

const readPrepared = (context: Context) => {
  const { prepared } = context.update.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has nothing prepared.");
  }

  return prepared.value;
};

// A package found and staged: what a reload needs.
const stage = async (context: Context) => {
  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  await context.update.download({ offer: offer.ref });

  return readPrepared(context);
};

const packageIdentity = (hash: string) => ({
  status: "known",
  authority: "code-push",
  domain: "package-hash",
  value: hash,
});

test("creating the route and the beacon call the SDK not at all", () => {
  const { calls, metadata, listeners } = create();

  expect(calls).toEqual({ checks: 0, downloads: 0, installs: 0, restarts: 0 });
  expect(metadata).toEqual([]);
  expect(listeners()).toBe(0);
});

test("starting the session reads what is pending and nothing else", async () => {
  const context = create({ bundle: false });

  context.beacon.start();
  await settle();

  expect(context.metadata).toEqual([context.updateState.PENDING]);
  expect(context.calls).toEqual({
    checks: 0,
    downloads: 0,
    installs: 0,
    restarts: 0,
  });
});

test("a check reports a package as an offer named by its hash, asks with no argument and downloads nothing", async () => {
  const context = create();

  context.willCheck(
    context.remotePackage(HASH_A, { label: "v7", mandatory: true }),
  );

  const offer = await checkOffer(context);

  expect(offer).toMatchObject({
    release: { identity: packageIdentity(HASH_A) },
    label: "v7",
    mandatory: true,
    failedInstall: false,
  });
  expect(context.checkArguments).toEqual([0]);
  expect(context.calls).toEqual({
    checks: 1,
    downloads: 0,
    installs: 0,
    restarts: 0,
  });
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
});

test("the deployment key a package carries reaches no state, receipt, running fact or diagnostic of Beacon", async () => {
  const context = create();

  // The packages of Microsoft's and Revopush's CodePush carry the deployment key, though no type here names it.
  const leaky = {
    ...context.remotePackage(HASH_A),
    deploymentKey: "SECRET-DEPLOYMENT-KEY",
  };

  context.willCheck(leaky);

  const offer = await checkOffer(context);
  const outcome = await context.update.download({ offer: offer.ref });

  expect(
    JSON.stringify({
      state: context.update.state.get(),
      outcome,
      running: context.beacon.running.get(),
      diagnostics: context.beacon.diagnostics.get(),
    }),
  ).not.toContain("SECRET-DEPLOYMENT-KEY");
  expect(outcome).toMatchObject({ status: "accepted" });
});

test("a check that finds no package is none with the detail no-package-for-binary, never up to date", async () => {
  const context = create();

  context.beacon.start();
  await context.update.check();

  expect(context.update.state.get().observation).toMatchObject({
    status: "none",
    reason: "no-decision",
    detail: "no-package-for-binary",
  });
});

test("a check that finds no package replaces the offer before it, so the old reference is refused", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  context.willCheck(null);
  await context.update.check();

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "replaced",
  });
  expect(context.calls.downloads).toBe(0);
});

test("a rejected check fails the check and keeps what was observed", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  context.willCheck(new Error("timeout"));

  await expect(context.update.check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });
  expect(context.update.state.get().observation).toMatchObject({
    status: "available",
    offer: { ref: offer.ref },
  });
});

test("a package this device installed before and rolled back is offered, and its download is unsupported", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A, { failedInstall: true }));

  const offer = await checkOffer(context);

  expect(offer).toMatchObject({ failedInstall: true });

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "unsupported",
    reason: "previously-rolled-back",
  });
  expect(context.calls).toMatchObject({ downloads: 0, installs: 0 });
});

test("a package with no hash is offered under an identity that names nothing, and cannot be downloaded", async () => {
  const context = create();

  context.willCheck(context.remotePackage(" "));

  const offer = await checkOffer(context);

  expect(offer.release.identity).toEqual({
    status: "unknown",
    reason: "package-hash-missing",
  });

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "unsupported",
    reason: "package-hash-missing",
  });
  expect(context.calls.downloads).toBe(0);
});

test("a label that is blank is no label", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A, { label: "  " }));

  await expect(checkOffer(context)).resolves.toMatchObject({ label: null });
});

test("SAFE-12 downloading may activate on the next start, which the route declares before the user agrees", () => {
  const { update } = create();

  expect(update.capabilities).toEqual({
    download: {
      reference: "offer",
      impacts: ["may-activate-on-next-start"],
      binding: "exact-instance",
    },
    reload: {
      reference: "prepared",
      impacts: ["javascript-restart"],
      binding: "provider-current",
    },
  });
});

test("a download stages the package for the next start and is accepted once CodePush lists it as pending", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A, { label: "v7" }));

  const offer = await checkOffer(context);

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: { kind: "update-staged", update: { hash: HASH_A, label: "v7" } },
  });
  expect(context.calls).toEqual({
    checks: 1,
    downloads: 1,
    installs: 1,
    restarts: 0,
  });
  expect(context.installModes).toEqual([context.installMode]);
  expect(context.metadata.at(-1)).toBe(context.updateState.PENDING);
  expect(context.update.state.get().prepared).toMatchObject({
    status: "ready",
    value: {
      release: { identity: packageIdentity(HASH_A) },
      label: "v7",
      mandatory: false,
    },
  });
  expect(context.update.state.get().operation).toEqual({ state: "idle" });
});

test("the download reads its progress from the SDK, a fraction while it runs and none when CodePush gave no total", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.willReport({ receivedBytes: 1_024, totalBytes: 4_096 });

  const offer = await checkOffer(context);

  context.hold("downloads");

  const downloading = context.update.download({ offer: offer.ref });

  await settle();

  expect(context.update.state.get().operation).toMatchObject({
    state: "running",
    command: "download",
    progress: 0.25,
  });

  context.report({ receivedBytes: 3_072, totalBytes: 4_096 });
  expect(context.update.state.get().operation).toMatchObject({
    progress: 0.75,
  });

  context.report({ receivedBytes: 10, totalBytes: 0 });
  expect(context.update.state.get().operation).toMatchObject({
    progress: null,
  });

  context.release("downloads");
  await expect(downloading).resolves.toMatchObject({ status: "accepted" });
});

test("the adapter holds a progress listener only through the SDK's own subscription, for as long as a download runs", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  expect(context.listeners()).toBe(0);

  context.hold("downloads");

  const downloading = context.update.download({ offer: offer.ref });

  await settle();
  expect(context.listeners()).toBe(1);

  context.release("downloads");
  await downloading;
  expect(context.listeners()).toBe(0);
});

test("a progress event that arrives after the session ended changes nothing and is not counted as late", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  context.hold("downloads");

  const downloading = context.update.download({ offer: offer.ref });

  await settle();
  context.beacon.stop();
  await settle();

  const before = context.update.state.get();

  context.report({ receivedBytes: 1_024, totalBytes: 4_096 });
  context.release("downloads");
  await downloading;

  expect(context.update.state.get()).toBe(before);
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("a download the SDK rejects is a failed command that installs and prepares nothing", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.willDownload(new Error("network lost"));

  const offer = await checkOffer(context);

  await expect(
    context.update.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.calls.installs).toBe(0);
  expect(context.listeners()).toBe(0);
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
  expect(context.update.state.get().operation).toEqual({ state: "idle" });
});

test("an install the SDK rejects is a failed command, and prepares nothing", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.willInstall(new Error("disk full"));

  const offer = await checkOffer(context);

  await expect(
    context.update.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
});

test("an install that returns and leaves nothing pending is not accepted: it is indeterminate until the application acknowledges", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.installsNothing();

  const offer = await checkOffer(context);

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "indeterminate",
    operation: { id: 1 },
    reason: "install-unconfirmed",
  });
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
  expect(context.update.state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "install-unconfirmed",
  });

  context.update.acknowledge();
  expect(context.update.state.get().operation).toEqual({ state: "idle" });
});

test("an install after which another package is pending is not accepted either", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.installsNothing();

  const offer = await checkOffer(context);

  context.setPending(localPackage(HASH_B));

  await expect(
    context.update.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "indeterminate",
    reason: "install-unconfirmed",
  });
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
});

test("an install after which CodePush cannot be asked what is pending may have taken effect, so it is indeterminate and not failed", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.failsReadingAfterInstall(new Error("no native module"));

  const offer = await checkOffer(context);

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "indeterminate",
    operation: { id: 1 },
    reason: "install-unconfirmed",
  });
  expect(context.calls.installs).toBe(1);
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
});

test("a download that hands back another package than the one offered installs nothing", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.downloadsAs(HASH_B);

  const offer = await checkOffer(context);

  await expect(
    context.update.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.calls.installs).toBe(0);
  expect(context.installModes).toEqual([]);
});

// CodePush deletes the folder of a package it downloads, and the folder of a package it installed is the one it runs or will run from.
test("an offer whose package was staged is refused the second time, and the package is not downloaded again", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  await context.update.download({ offer: offer.ref });

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });
  expect(context.calls.downloads).toBe(1);
});

test("an offer whose package was installed is refused a second time, whatever the install answered", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.willInstall(new Error("disk full"));

  const offer = await checkOffer(context);

  await context.update.download({ offer: offer.ref });

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "stale",
    reason: "provider-changed",
  });
  expect(context.calls.downloads).toBe(1);
});

test("an offer whose download failed can be tried again", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));
  context.willDownload(new Error("network lost"));

  const offer = await checkOffer(context);

  await context.update.download({ offer: offer.ref });

  await expect(
    context.update.download({ offer: offer.ref }),
  ).resolves.toMatchObject({ status: "accepted" });
  expect(context.calls.downloads).toBe(2);
});

test("a package a check found while another one downloaded is still there to be downloaded", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const first = await checkOffer(context);

  context.hold("downloads");

  const downloading = context.update.download({ offer: first.ref });

  await settle();
  context.willCheck(context.remotePackage(HASH_B, { label: "v3" }));
  await context.update.check();

  const { observation } = context.update.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  context.release("downloads");
  await downloading;

  await expect(
    context.update.download({ offer: observation.offer.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "update-staged", update: { hash: HASH_B, label: "v3" } },
  });
});

test("a caller who stops waiting during the download is told it is indeterminate, and nothing is installed after it", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);
  const controller = new AbortController();

  context.hold("downloads");

  const downloading = context.update.download({
    offer: offer.ref,
    signal: controller.signal,
  });

  await settle();
  controller.abort();

  await expect(downloading).resolves.toMatchObject({
    status: "indeterminate",
    reason: "aborted-after-dispatch",
  });

  context.release("downloads");
  await settle();

  expect(context.calls.installs).toBe(0);
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
  expect(context.update.state.get().operation).toEqual({ state: "idle" });
});

test("a session that ends during the download installs nothing and reports nothing late", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  context.hold("downloads");

  const downloading = context.update.download({ offer: offer.ref });

  await settle();
  context.beacon.stop();
  context.release("downloads");
  await downloading;
  await settle();

  expect(context.calls.installs).toBe(0);
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("a beacon disposed during the download installs nothing and throws into nobody", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  context.hold("downloads");

  const downloading = context.update.download({ offer: offer.ref });

  await settle();
  context.beacon.dispose();
  context.release("downloads");
  await downloading;
  await settle();

  expect(context.calls.installs).toBe(0);
  expect(context.listeners()).toBe(0);
});

test("a session that ends while the install runs still answers what CodePush says, and reports no preparation late", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  context.hold("installs");

  const downloading = context.update.download({ offer: offer.ref });

  await settle();
  context.beacon.stop();
  context.release("installs");

  await expect(downloading).resolves.toMatchObject({
    status: "indeterminate",
    reason: "aborted-after-dispatch",
  });
  await settle();

  expect(context.calls.installs).toBe(1);
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("a session that ends while CodePush is asked what is pending reports nothing late", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  await settle();
  context.hold("metadata");

  const downloading = context.update.download({ offer: offer.ref });

  await settle();
  context.beacon.stop();
  context.release("metadata");
  await downloading;
  await settle();

  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("a download after the session ended reports nothing to the route", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);
  const before = context.update.state.get();

  context.beacon.stop();

  await expect(
    context.update.download({ offer: offer.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "NOT_STARTED" },
  });
  expect(context.update.state.get()).toBe(before);
  expect(context.calls.downloads).toBe(0);
});

test("a check that answered after it timed out leaves the package the route took, and its offer can still be downloaded", async () => {
  const context = create();

  context.willCheck(context.remotePackage(HASH_A));

  const offer = await checkOffer(context);

  context.willCheck(context.remotePackage(HASH_B));
  context.hold("checks");

  const checking = context.update.check();

  await settle();
  context.clock.advance(10_000);

  await expect(checking).resolves.toMatchObject({
    status: "failed",
    error: { code: "SOURCE_TIMEOUT" },
  });

  context.release("checks");
  await settle();

  await expect(context.update.download({ offer: offer.ref })).resolves.toEqual({
    status: "accepted",
    operation: { id: 1 },
    receipt: { kind: "update-staged", update: { hash: HASH_A, label: "v2" } },
  });
});

test("a reload asks CodePush to restart for the pending package, and the route is unresolved until the application acknowledges", async () => {
  const context = create();
  const prepared = await stage(context);

  await expect(
    context.update.reload({ prepared: prepared.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
  expect(context.calls.restarts).toBe(1);
  expect(context.restartFlags).toEqual([true]);
  expect(context.update.state.get().operation).toMatchObject({
    state: "indeterminate",
    reason: "dispatch-unconfirmed",
  });
});

test("a reload that finds another package pending than the one the user agreed to is stale and restarts nothing", async () => {
  const context = create();
  const prepared = await stage(context);

  context.setPending(localPackage(HASH_B));

  await expect(
    context.update.reload({ prepared: prepared.ref }),
  ).resolves.toEqual({ status: "stale", reason: "provider-changed" });
  expect(context.calls.restarts).toBe(0);
  expect(context.update.state.get().operation).toEqual({ state: "idle" });
});

test("a reload that finds nothing pending is stale and restarts nothing", async () => {
  const context = create();
  const prepared = await stage(context);

  context.setPending(null);

  await expect(
    context.update.reload({ prepared: prepared.ref }),
  ).resolves.toEqual({ status: "stale", reason: "provider-changed" });
  expect(context.calls.restarts).toBe(0);
});

test("a reload of a prepared reference that a later download replaced is refused before CodePush is asked", async () => {
  const context = create();
  const old = await stage(context);

  context.willCheck(context.remotePackage(HASH_B));
  await context.update.check();

  const { observation } = context.update.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await context.update.download({ offer: observation.offer.ref });

  const metadata = context.metadata.length;

  await expect(context.update.reload({ prepared: old.ref })).resolves.toEqual({
    status: "stale",
    reason: "replaced",
  });
  expect(context.metadata.length).toBe(metadata);
  expect(context.calls.restarts).toBe(0);
});

test("a restart that throws is a failed command, and the route is free again", async () => {
  const context = create();
  const prepared = await stage(context);

  context.willRestart({ kind: "throws", error: new Error("no module") });

  await expect(
    context.update.reload({ prepared: prepared.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.update.state.get().operation).toEqual({ state: "idle" });
});

test("a restart that rejects is a failed command, not an unhandled rejection", async () => {
  const context = create();
  const prepared = await stage(context);

  context.willRestart({ kind: "rejects", error: new Error("no module") });

  await expect(
    context.update.reload({ prepared: prepared.ref }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "COMMAND_FAILED" },
  });
  expect(context.update.state.get().operation).toEqual({ state: "idle" });
});

test("a restart whose declaration says it returns nothing is accepted as it returns", async () => {
  const context = create();
  const prepared = await stage(context);

  context.willRestart({ kind: "returns" });

  await expect(
    context.update.reload({ prepared: prepared.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
});

test("a restart that never returns, as a runtime that restarts first, is never answered as accepted", async () => {
  const context = create();
  const prepared = await stage(context);
  const controller = new AbortController();

  context.willRestart({ kind: "never settles" });

  const reloading = context.update.reload({
    prepared: prepared.ref,
    signal: controller.signal,
  });

  await settle();
  controller.abort();

  await expect(reloading).resolves.toMatchObject({
    status: "indeterminate",
    reason: "aborted-after-dispatch",
  });
  expect(context.calls.restarts).toBe(1);
});

test("a caller who stops waiting while CodePush is asked what is pending restarts nothing", async () => {
  const context = create();
  const prepared = await stage(context);
  const controller = new AbortController();

  await settle();
  context.hold("metadata");

  const reloading = context.update.reload({
    prepared: prepared.ref,
    signal: controller.signal,
  });

  await settle();
  controller.abort();
  context.release("metadata");

  await expect(reloading).resolves.toMatchObject({ status: "indeterminate" });
  await settle();

  expect(context.calls.restarts).toBe(0);
  expect(context.update.state.get().operation).toEqual({ state: "idle" });
});

test("a session that ends while CodePush is asked what is pending restarts nothing", async () => {
  const context = create();
  const prepared = await stage(context);

  await settle();
  context.hold("metadata");

  const reloading = context.update.reload({ prepared: prepared.ref });

  await settle();
  context.beacon.stop();
  context.release("metadata");
  await reloading;
  await settle();

  expect(context.calls.restarts).toBe(0);
});

test("a package that was pending when the session opened is prepared without a command", async () => {
  const context = create();

  context.setPending(localPackage(HASH_A, { label: "v3", mandatory: true }));
  context.beacon.start();
  await settle();

  expect(context.update.state.get().prepared).toMatchObject({
    status: "ready",
    value: {
      release: { identity: packageIdentity(HASH_A) },
      label: "v3",
      mandatory: true,
    },
  });
  expect(context.calls).toEqual({
    checks: 0,
    downloads: 0,
    installs: 0,
    restarts: 0,
  });
});

test("a pending package that was found on start can be reloaded", async () => {
  const context = create();

  context.setPending(localPackage(HASH_A));
  context.beacon.start();
  await settle();

  const prepared = readPrepared(context);

  await expect(
    context.update.reload({ prepared: prepared.ref }),
  ).resolves.toMatchObject({ status: "accepted" });
  expect(context.calls.restarts).toBe(1);
});

test("nothing pending when the session opens says nothing: CodePush cannot say that nothing is prepared", async () => {
  const context = create();

  context.beacon.start();
  await settle();

  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
});

test("a pending package with no hash is not vouched for", async () => {
  const context = create();

  context.setPending(localPackage(""));
  context.beacon.start();
  await settle();

  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
});

test("a read of what is pending that fails is a failed route, and throws into nobody", async () => {
  const context = create();
  const failed: Array<string | null> = [];

  context.beacon.diagnostics.events.subscribe((event) => {
    if (event.type !== "route-failed") {
      return;
    }

    failed.push(event.reason);
  });

  context.codePush.getUpdateMetadata = async () => {
    throw new Error("no native module");
  };

  context.beacon.start();
  await settle();

  expect(failed).toEqual(["DRIVER_FAILED"]);
  expect(context.update.state.get().prepared).toEqual({ status: "unknown" });
});

test("a session that ends while CodePush is asked what is pending at its start reports nothing", async () => {
  const context = create({ bundle: false });

  context.setPending(localPackage(HASH_A));
  context.hold("metadata");
  context.beacon.start();
  await settle();
  context.beacon.stop();

  const before = context.update.state.get();

  context.release("metadata");
  await settle();

  expect(context.update.state.get()).toBe(before);
  expect(context.beacon.diagnostics.get().counters.lateCallbacks).toBe(0);
});

test("the package a download prepared is named the way the bundle reader names it once it runs", async () => {
  const context = create();
  const prepared = await stage(context);

  context.launchAgain();

  const running = await codePushBundle({ codePush: context.codePush })({
    scope: SCOPE,
  });

  expect(compareIdentities(prepared.release.identity, running.identity)).toBe(
    "same",
  );
});

test("the route reads the running bundle from CodePush, and a reader the application passes wins", async () => {
  const create = (running: RunningReaders) => {
    const fake = fakeCodePush({ running: localPackage(HASH_A) });

    const beacon = new Beacon({
      scope: SCOPE,
      running,
      routes: { update: codePushUpdates({ codePush: fake.codePush }) },
      clock: createTestClock({ now: 1_000 }),
    });

    return { fake, beacon };
  };

  const routeOnly = create({});

  routeOnly.beacon.start();
  await settle();

  expect(routeOnly.beacon.running.get().bundle).toMatchObject({
    state: "known",
    release: { identity: { status: "known", value: HASH_A } },
  });

  const explicit = create({ bundle: () => NOT_READ });

  explicit.beacon.start();
  await settle();

  expect(explicit.beacon.running.get().bundle).toMatchObject({
    state: "known",
    release: { identity: { reason: "not-read" } },
  });
  expect(explicit.fake.metadata).not.toContain(
    explicit.fake.updateState.RUNNING,
  );
});

test("the journal reads a reload back as reached when the next launch runs the staged package", async () => {
  const fake = fakeCodePush();
  const storage = createMockJournalStorage();

  const open = (boot: string) =>
    new Beacon({
      scope: SCOPE,
      running: { boot: { id: boot } },
      routes: { update: codePushUpdates({ codePush: fake.codePush }) },
      journal: { mode: "required", storage },
      clock: createTestClock({ now: 1_000 }),
    });

  const first = open("boot-1");
  const route = first.route("update");

  fake.willCheck(fake.remotePackage(HASH_A));
  first.start();
  await route.check();

  const { observation } = route.state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await route.download({ offer: observation.offer.ref });

  const { prepared } = route.state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has nothing prepared.");
  }

  await expect(
    route.reload({ prepared: prepared.value.ref }),
  ).resolves.toMatchObject({
    status: "accepted",
  });

  first.stop();
  fake.launchAgain();

  const second = open("boot-2");

  second.start();
  await settle();

  expect(second.transitions.get().latest).toMatchObject({
    outcome: "target-running",
    intent: { route: "update", command: "reload", binding: "provider-current" },
  });
});

test("the route calls only the members its type lists, and checks with no argument", async () => {
  const context = create();
  const touched = new Set<string>();

  const codePush = new Proxy(context.codePush, {
    get: (target, key) => {
      touched.add(String(key));

      return Reflect.get(target, key);
    },
  });

  const beacon = new Beacon({
    scope: SCOPE,
    routes: { update: codePushUpdates({ codePush }) },
    clock: createTestClock({ now: 1_000 }),
  });

  context.willCheck(context.remotePackage(HASH_A));
  beacon.start();
  await beacon.route("update").check();

  const { observation } = beacon.route("update").state.get();

  if (observation.status !== "available") {
    throw new Error("The route has no offer.");
  }

  await beacon.route("update").download({ offer: observation.offer.ref });

  const { prepared } = beacon.route("update").state.get();

  if (prepared.status !== "ready") {
    throw new Error("The route has nothing prepared.");
  }

  await beacon.route("update").reload({ prepared: prepared.value.ref });

  expect([...touched].sort()).toEqual([
    "InstallMode",
    "UpdateState",
    "checkForUpdate",
    "getUpdateMetadata",
    "restartApp",
  ]);
  expect(context.checkArguments).toEqual([0]);
  expect(context.installModes).toEqual([context.installMode]);
});

test("the route has the commands it declares and nothing that could check, install or restart on its own", () => {
  const { update } = create();

  expect(Object.keys(update.capabilities).sort()).toEqual([
    "download",
    "reload",
  ]);
  expect(
    Object.keys(update).filter((key) =>
      /^(sync|install|notify|allow|disallow|configure|clear)/i.test(key),
    ),
  ).toEqual([]);
});

test("the native handle is the injected module while a session runs", () => {
  const context = create();

  expect(context.update.native.get()).toBeNull();

  context.beacon.start();

  expect(context.update.native.get()?.codePush).toBe(context.codePush);
});

test("LIFE-11 a second Beacon on the same module cannot open the route, and says so", async () => {
  const fake = fakeCodePush();

  const open = () =>
    new Beacon({
      scope: SCOPE,
      running: { boot: { id: "boot-1" } },
      routes: { update: codePushUpdates({ codePush: fake.codePush }) },
      clock: createTestClock({ now: 1_000 }),
    });

  const first = open();
  const second = open();

  const stop = first.start();

  second.start();

  expect(first.route("update").native.get()).not.toBeNull();
  expect(second.route("update").native.get()).toBeNull();

  await expect(second.route("update").check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "DRIVER_FAILED" },
  });

  stop();
  second.stop();
  second.start();

  expect(second.route("update").native.get()).not.toBeNull();
});
