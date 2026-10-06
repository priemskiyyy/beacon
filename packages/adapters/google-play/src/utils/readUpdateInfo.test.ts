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
    prepared: null,
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
  const { observation, prepared } = readUpdateInfo(
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
  expect(prepared).toBeNull();
});

test("PLAY-13 an available update Play reports as downloaded is prepared under the release of that query", () => {
  const { observation, prepared } = readUpdateInfo(
    availableInfo(412, { installStatus: "downloaded" }),
    APPLICATION,
  );

  if (observation.status !== "available") {
    throw new Error("The reading has no offer.");
  }

  expect(prepared).toEqual({
    status: "ready",
    value: { release: observation.offer.release },
  });
});

test("both flows are offered when Play allows both", () => {
  const { observation } = readUpdateInfo(availableInfo(412), APPLICATION);

  expect(observation).toMatchObject({
    offer: { flows: ["flexible", "immediate"] },
  });
});

test("a flow Play still holds is offered as a continuation with no version to name", () => {
  const { observation, prepared } = readUpdateInfo(
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
  expect(prepared).toBeNull();
});

test("PLAY-02 an answer outside Play's four categories is an environment that cannot say, never an offer", () => {
  // What a native module can hand over, though its type says otherwise.
  const stray: PlayUpdateInfo = JSON.parse(
    '{"availability":"maybe","versionCode":412}',
  );

  expect(readUpdateInfo(stray, APPLICATION)).toEqual({
    observation: { status: "unknown", reason: "unsupported-environment" },
    prepared: null,
  });
});

test("PLAY-02 a version code above the highest Play accepts for a published build is an environment that cannot say, and that highest one is a build", () => {
  // Play refuses to publish a version code above 2,100,000,000, so a larger one is a bridge that garbled its answer.
  expect(readUpdateInfo(availableInfo(2_100_000_001), APPLICATION)).toEqual({
    observation: { status: "unknown", reason: "unsupported-environment" },
    prepared: null,
  });
  expect(
    readUpdateInfo(availableInfo(2_100_000_000), APPLICATION).observation,
  ).toMatchObject({
    status: "available",
    offer: { release: { identity: { value: "2100000000" } } },
  });
});

test("PLAY-02 an available answer whose version code is no positive integer is an environment that cannot say, never a known identity", () => {
  const rest =
    '"flexible":true,"immediate":true,"priority":2,"stalenessDays":5,"installStatus":"downloaded"';

  // What a native module can hand over, though its type says otherwise.
  const strays: PlayUpdateInfo[] = [
    `{"availability":"available",${rest}}`,
    `{"availability":"available","versionCode":null,${rest}}`,
    `{"availability":"available","versionCode":"412",${rest}}`,
  ].map((text) => JSON.parse(text));

  const numbers = [Number.NaN, Infinity, -412, 0, 412.5].map((code) =>
    availableInfo(code, { installStatus: "downloaded" }),
  );

  for (const info of [...strays, ...numbers]) {
    expect(readUpdateInfo(info, APPLICATION)).toEqual({
      observation: { status: "unknown", reason: "unsupported-environment" },
      prepared: null,
    });
  }
});
