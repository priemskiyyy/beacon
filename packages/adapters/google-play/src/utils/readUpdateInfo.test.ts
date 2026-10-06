import { expect, test } from "vitest";

import { availableInfo } from "src/fakeBridge.fixture";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";
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

test("PLAY-02 an answer outside Play's four categories is an environment that cannot say, never an offer", () => {
  // What a native module can hand over, though its type says otherwise.
  const stray: PlayUpdateInfo = JSON.parse(
    '{"availability":"maybe","versionCode":412}',
  );

  expect(readUpdateInfo(stray, APPLICATION)).toEqual({
    observation: { status: "unknown", reason: "unsupported-environment" },
    release: null,
    installStatus: null,
  });
});
