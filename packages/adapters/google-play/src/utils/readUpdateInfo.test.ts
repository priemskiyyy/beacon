import { expect, test } from "vitest";

import { availableInfo } from "src/fakeBridge.fixture";
import { readUpdateInfo } from "src/utils/readUpdateInfo";

const APPLICATION = "com.example.notes";

test("not available is no offer here, and says nothing about other releases", () => {
  expect(
    readUpdateInfo({ availability: "not-available" }, APPLICATION),
  ).toEqual({
    observation: {
      status: "none",
      reason: "no-decision",
      detail: "not-available",
    },
    release: null,
    installStatus: null,
  });
});

test("PLAY-02 unknown, as without Play services, is an environment that cannot say, not no update", () => {
  expect(
    readUpdateInfo({ availability: "unknown" }, APPLICATION).observation,
  ).toEqual({
    status: "unknown",
    reason: "unsupported-environment",
  });
});

test("an available update is named by its version code, with the flows Play allows and its own facts", () => {
  const { observation, release } = readUpdateInfo(
    availableInfo(412, { immediate: false, priority: 4, stalenessDays: 11 }),
    APPLICATION,
  );

  expect(observation).toEqual({
    status: "available",
    offer: {
      release: {
        identity: {
          status: "known",
          authority: APPLICATION,
          domain: "android-version-code",
          value: "412",
        },
      },
      flows: ["flexible"],
      priority: 4,
      stalenessDays: 11,
      inProgress: false,
    },
  });
  expect(release).not.toBeNull();
});

test("both flows are offered when Play allows both", () => {
  const { observation } = readUpdateInfo(availableInfo(412), APPLICATION);

  expect(observation).toMatchObject({
    offer: { flows: ["flexible", "immediate"] },
  });
});

test("a flow Play still holds is offered as a continuation with no version to name", () => {
  const { observation, installStatus } = readUpdateInfo(
    { availability: "in-progress", installStatus: "downloading" },
    APPLICATION,
  );

  expect(observation).toMatchObject({
    status: "available",
    offer: {
      release: {
        identity: { status: "unknown", reason: "play-update-in-progress" },
      },
      flows: ["immediate"],
      inProgress: true,
    },
  });
  expect(installStatus).toBe("downloading");
});
