import { createTestClock } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { formatTimelineEntry } from "example-shared/formatting/formatTimelineEntry";
import { CHECK_TIMEOUT, MANIFEST_TTL } from "example-shared/lab/constants/lab";
import { createReleaseLab } from "example-shared/lab/createReleaseLab";

// Lets every queued promise continuation run before the test goes on; time itself is the test clock's.
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const setup = () => {
  const clock = createTestClock({ now: 1_000_000 });
  const lab = createReleaseLab({ clock });
  const beacon = () => lab.boot.get().beacon;
  const web = () => beacon().route("web");

  const reads = () =>
    lab.timeline
      .getSnapshot()
      .filter(
        (entry) =>
          entry.source === "diagnostic" && entry.event.type === "read-started",
      ).length;

  beacon().start();

  const offer = () => {
    const { observation } = web().state.get();

    if (observation.status !== "available") {
      throw new Error(`Nothing is on offer: ${observation.status}.`);
    }

    return observation.offer.ref;
  };

  // The next document is started the way the provider of an application starts it.
  const boot = async () => {
    lab.controls.install();
    beacon().start();
    await lab.controls.check("startup");
    await settle();
  };

  return { clock, lab, beacon, web, offer, boot, reads };
};

test("a checked lab is up to date on the build it runs", async () => {
  const { lab, beacon, web, reads } = setup();
  const report = await lab.controls.check("startup");

  expect(report).toEqual({
    routes: { web: { status: "succeeded", attempt: 1 } },
    support: { status: "succeeded", attempt: 1 },
  });
  expect(reads()).toBe(1);
  expect(web().state.get().observation).toMatchObject({
    status: "none",
    reason: "same-identity",
  });
  expect(beacon().running.get().web).toMatchObject({
    state: "known",
    release: { label: "Build 1" },
  });
  expect(beacon().support.get().status).toBe("supported");
});

test("a published build is offered once it is checked, and not before", async () => {
  const { lab, web } = setup();

  await lab.controls.check();
  lab.controls.publish();
  expect(web().state.get().observation.status).toBe("none");

  await lab.controls.check();
  expect(web().state.get().observation).toMatchObject({
    status: "available",
    evidence: { source: "release-manifest", origin: "network" },
    offer: { release: { label: "Build 2" } },
  });
});

test("an update while the draft has unsaved changes is blocked, and works once it is saved", async () => {
  const { lab, web, offer } = setup();

  lab.controls.publish();
  await lab.controls.check();
  lab.controls.setDraft(true);

  await expect(web().reload({ offer: offer() })).resolves.toEqual({
    status: "blocked",
    reasons: [{ code: "unsaved-draft", participant: { name: "draft-editor" } }],
  });
  expect(web().state.get().operation).toEqual({ state: "idle" });
  expect(lab.draft.get()).toEqual({ dirty: true, locked: false });

  lab.controls.setDraft(false);

  await expect(web().reload({ offer: offer() })).resolves.toMatchObject({
    status: "accepted",
    receipt: { kind: "reload-requested" },
  });
});

test("an accepted reload locks the draft and changes nothing that runs", async () => {
  const { lab, beacon, web, offer } = setup();

  lab.controls.publish();
  await lab.controls.check();
  await web().reload({ offer: offer() });
  lab.controls.setDraft(true);

  expect(lab.draft.get()).toEqual({ dirty: false, locked: true });
  expect(web().state.get().operation).toMatchObject({
    state: "indeterminate",
    command: "reload",
  });
  expect(beacon().running.get().web).toMatchObject({
    release: { label: "Build 1" },
  });

  web().acknowledge();
  expect(lab.draft.get().locked).toBe(false);
  expect(web().state.get().operation).toEqual({ state: "idle" });
});

test("the next document reads the journal and reports the intent reached its target", async () => {
  const { lab, beacon, web, offer, boot } = setup();
  const first = beacon();

  await lab.controls.check();
  lab.controls.publish();
  await lab.controls.check();
  await settle();
  await web().reload({ offer: offer() });
  await boot();

  expect(first.status.get()).toEqual({ state: "disposed" });
  expect(lab.boot.get()).toMatchObject({ number: 2, build: 2 });
  expect(beacon().running.get().web).toMatchObject({
    release: { label: "Build 2" },
  });
  expect(beacon().transitions.get()).toMatchObject({
    journal: "ready",
    latest: {
      outcome: "target-running",
      attempts: 0,
      intent: { command: "reload", route: "web", boot: { id: "boot-1" } },
    },
  });
  expect(lab.draft.get().locked).toBe(false);
});

test("a build published after the offer is what the next document runs", async () => {
  const { lab, web, offer, boot, beacon } = setup();

  lab.controls.publish();
  await lab.controls.check();
  await settle();

  const shown = offer();

  lab.controls.publish();
  await web().reload({ offer: shown });
  await boot();

  expect(beacon().running.get().web).toMatchObject({
    release: { label: "Build 3" },
  });
  expect(beacon().transitions.get().latest).toMatchObject({
    outcome: "different-target",
  });
});

test("a lagging deployment leaves the target unreached until the attempt budget is spent", async () => {
  const { lab, web, offer, boot, beacon } = setup();

  lab.controls.setLagging(true);
  lab.controls.publish();
  await lab.controls.check();
  await settle();
  await web().reload({ offer: offer() });
  await boot();

  expect(beacon().transitions.get().latest).toMatchObject({
    outcome: "target-not-running",
    attempts: 1,
    exhausted: false,
  });

  await web().reload({ offer: offer() });
  await boot();

  expect(beacon().transitions.get().latest).toMatchObject({
    outcome: "target-not-running",
    attempts: 2,
    exhausted: true,
  });

  lab.controls.setLagging(false);
  await lab.controls.check();
  await web().reload({ offer: offer() });
  await boot();

  expect(beacon().transitions.get().latest).toMatchObject({
    outcome: "target-running",
  });
});

test("a required build makes the running build unsupported and names the route that satisfies it", async () => {
  const { lab, beacon } = setup();

  lab.controls.publishRequired();
  await lab.controls.check();

  expect(beacon().support.get()).toMatchObject({
    status: "unsupported",
    evaluation: {
      reasons: [{ code: "below-minimum", subject: "web" }],
      remediation: [{ route: "web", level: "required", usable: true }],
    },
  });
});

test("an ended build with nothing on offer is unsupported and no route is usable", async () => {
  const { lab, beacon } = setup();

  lab.controls.endRunning();
  await lab.controls.check();

  expect(beacon().support.get()).toMatchObject({
    status: "unsupported",
    evaluation: {
      reasons: [{ code: "build-ended", subject: "web" }],
      remediation: [{ route: "web", level: "required", usable: false }],
    },
  });
});

test("a failing manifest keeps the previous decision and says the check failed", async () => {
  const { lab, beacon, web, offer } = setup();

  lab.controls.publish();
  await lab.controls.check();

  const shown = offer();

  lab.controls.setFailing(true);

  const report = await lab.controls.check();

  expect(report.routes.web).toMatchObject({
    status: "failed",
    error: { code: "SOURCE_FAILED" },
  });
  expect(web().state.get()).toMatchObject({
    check: { state: "failed" },
    observation: { status: "available", offer: { ref: shown } },
  });
  expect(beacon().support.get().status).toBe("supported");

  lab.controls.setFailing(false);
  await expect(lab.controls.check()).resolves.toMatchObject({
    routes: { web: { status: "succeeded" } },
  });
});

test("a manifest that fails before any check leaves nothing observed", async () => {
  const { lab, web, beacon } = setup();

  lab.controls.setFailing(true);
  await lab.controls.check("startup");

  expect(web().state.get()).toMatchObject({
    check: { state: "failed" },
    observation: { status: "unknown", reason: "not-checked" },
  });
  expect(beacon().support.get()).toMatchObject({
    status: "unknown",
    reason: "not-checked",
  });
});

test("a slow manifest holds the read until it is answered", async () => {
  const { lab, web } = setup();

  lab.controls.setSlow(true);

  const pending = lab.controls.check();

  // The check waits for what runs, and only then asks the service, which holds the read on its own turn.
  await settle();
  await settle();
  expect(lab.world.get().waiting).toBe(1);
  expect(web().state.get().check).toMatchObject({ state: "checking" });

  lab.controls.answerHeld();
  await expect(pending).resolves.toMatchObject({
    routes: { web: { status: "succeeded" } },
  });
  expect(lab.world.get().waiting).toBe(0);
});

test("a slow manifest that is never answered fails the check at its deadline", async () => {
  const { lab, web } = setup();

  lab.controls.setSlow(true);

  const pending = lab.controls.check();

  await settle();
  lab.controls.skip(CHECK_TIMEOUT);

  await expect(pending).resolves.toMatchObject({
    routes: { web: { status: "failed", error: { code: "SOURCE_TIMEOUT" } } },
  });
  expect(web().state.get().check).toMatchObject({ state: "failed" });
  expect(lab.world.get().waiting).toBe(0);
});

test("an expired answer stays observed as expired, and a command with its offer is stale", async () => {
  const { lab, beacon, web, offer } = setup();

  lab.controls.publish();
  await lab.controls.check();

  const shown = offer();

  lab.controls.expire();

  expect(web().state.get().observation).toMatchObject({
    status: "available",
    evidence: { freshness: "expired" },
  });
  expect(beacon().support.get()).toMatchObject({
    status: "unknown",
    reason: "expired",
    evaluation: { status: "supported" },
  });
  await expect(web().reload({ offer: shown })).resolves.toEqual({
    status: "stale",
    reason: "expired",
  });

  await lab.controls.check();
  expect(web().state.get().observation).toMatchObject({
    status: "available",
    evidence: { freshness: "fresh" },
  });
  expect(beacon().support.get().status).toBe("supported");
});

test("an answer that is renewed keeps its offer", async () => {
  const { clock, lab, web, offer } = setup();

  lab.controls.publish();
  await lab.controls.check();

  const shown = offer();

  clock.advance(MANIFEST_TTL / 2);
  await lab.controls.check();

  expect(offer()).toBe(shown);
  expect(web().state.get().observation).toMatchObject({
    evidence: { expiresAt: 1_000_000 + MANIFEST_TTL / 2 + MANIFEST_TTL },
  });
});

test("a rollback is an ordinary offer of an older build", async () => {
  const { lab, web, offer, boot } = setup();

  lab.controls.publish();
  await lab.controls.check();
  await settle();
  await web().reload({ offer: offer() });
  await boot();

  lab.controls.rollBack();
  await lab.controls.check();

  expect(web().state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { label: "Build 1" } },
  });
});

test("when the service has nothing, the observation says so with its own reason", async () => {
  const { lab, web } = setup();

  lab.controls.publish();
  await lab.controls.check();
  lab.controls.noUpdate();
  await lab.controls.check();

  expect(web().state.get().observation).toMatchObject({
    status: "none",
    reason: "no-decision",
    detail: "up-to-date",
  });
});

test("reset starts a fresh world and an empty journal in a new document", async () => {
  const { lab, beacon, web, offer } = setup();
  const first = beacon();

  lab.controls.publishRequired();
  lab.controls.setDraft(true);
  await lab.controls.check();
  lab.controls.setDraft(false);
  await web().reload({ offer: offer() });
  lab.controls.reset();
  beacon().start();
  await lab.controls.check("startup");
  await settle();

  expect(first.status.get()).toEqual({ state: "disposed" });
  expect(lab.boot.get()).toMatchObject({ number: 2, build: 1 });
  expect(lab.world.get()).toMatchObject({
    deployed: 1,
    served: 1,
    minimumBuild: 1,
    revision: 1,
    failing: false,
  });
  expect(lab.draft.get()).toEqual({ dirty: false, locked: false });
  expect(beacon().transitions.get().latest).toBeNull();
  expect(beacon().support.get().status).toBe("supported");
});

test("the timeline lists diagnostics, journal changes and world changes, newest first", async () => {
  const { lab, web, offer, boot } = setup();

  lab.controls.publish();
  await lab.controls.check("startup");
  await web().reload({ offer: offer() });
  await boot();

  const entries = lab.timeline.getSnapshot();
  const sources = new Set(entries.map(({ source }) => source));
  const ids = entries.map(({ id }) => id);

  expect([...sources].sort()).toEqual(["diagnostic", "transition", "world"]);
  expect(ids).toEqual([...ids].sort((left, right) => right - left));

  const lines = entries.map(formatTimelineEntry).reverse();

  expect(lines).toContain("A new document boots and runs build 1");
  expect(lines).toContain("Build 2 is published");
  expect(lines).toContain("Check started (web, startup)");
  expect(lines).toContain("Command admitted (web.reload, operation 1)");
  expect(lines).toContain(
    "Command settled (web.reload, operation 1, accepted)",
  );
  expect(lines).toContain("The browser is asked to reload");
  expect(lines).toContain("A new document boots and runs build 2");
  expect(lines.some((line) => line.includes("target-running"))).toBe(true);
  expect(
    entries.filter(({ boot: number }) => number === 2).length,
  ).toBeGreaterThan(0);
});
