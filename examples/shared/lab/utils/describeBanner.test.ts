import { createTestClock } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { createReleaseLab } from "example-shared/lab/createReleaseLab";
import { describeBanner } from "example-shared/lab/utils/describeBanner";

const setup = () => {
  const lab = createReleaseLab({ clock: createTestClock({ now: 1_000_000 }) });
  const { beacon } = lab.boot.get();

  beacon.start();

  const banner = () =>
    describeBanner({
      observation: beacon.route("web").state.get().observation,
      support: beacon.support.get(),
    });

  return { lab, beacon, banner };
};

test("an unchecked lab says it has not checked", () => {
  const { banner } = setup();

  expect(banner()).toMatchObject({
    tone: "warning",
    headline: "Not checked yet",
  });
});

test("an offer is a banner of its own, and the build that runs is up to date", async () => {
  const { lab, banner } = setup();

  await lab.controls.check();
  expect(banner()).toMatchObject({
    tone: "positive",
    headline: "You are up to date",
  });

  lab.controls.publish();
  await lab.controls.check();
  expect(banner()).toMatchObject({
    tone: "accent",
    headline: "Build 2 is available",
  });
});

test("an unsupported build is the first thing the banner says, usable route or not", async () => {
  const { lab, banner } = setup();

  lab.controls.endRunning();
  await lab.controls.check();
  expect(banner()).toMatchObject({
    tone: "danger",
    headline: "This build is no longer supported",
    detail: expect.stringContaining("No update is usable yet"),
  });

  lab.controls.publish();
  await lab.controls.check();
  expect(banner()).toMatchObject({
    headline: "This build is no longer supported",
    detail: "The application requires an update to continue.",
  });
});

test("a gate stays closed when the policy lapses, because its last verdict is kept", async () => {
  const { lab, beacon, banner } = setup();

  lab.controls.publishRequired();
  await lab.controls.check();
  lab.controls.expire();

  expect(beacon.support.get()).toMatchObject({
    status: "unknown",
    reason: "expired",
  });
  expect(banner()).toMatchObject({
    headline: "This build is no longer supported",
  });
});
