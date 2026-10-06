import { expect, test } from "vitest";

import { expoBundle } from "src/expoBundle";
import { fakeUpdates, SCOPE, UPDATE_A } from "src/fakeUpdates.fixture";

test("the running bundle is the update that launched, with where it came from", async () => {
  const { updates } = fakeUpdates({ updateId: UPDATE_A });

  expect(await expoBundle({ updates })({ scope: SCOPE })).toEqual({
    identity: {
      status: "known",
      authority: "expo-updates",
      domain: "update",
      value: UPDATE_A,
    },
    label: null,
    raw: {
      channel: "production",
      runtimeVersion: "1.0.0",
      embedded: true,
      emergency: false,
    },
  });
});

test("where updates are disabled the running bundle has no identity", async () => {
  const { updates } = fakeUpdates({ updateId: null, isEnabled: false });

  expect((await expoBundle({ updates })({ scope: SCOPE })).identity).toEqual({
    status: "unknown",
    reason: "updates-disabled",
  });
});

test("the reader looks at the constants when it is read, not when it is created", async () => {
  const { updates } = fakeUpdates({ updateId: UPDATE_A });
  const read = expoBundle({ updates });

  updates.updateId = null;

  expect((await read({ scope: SCOPE })).identity).toMatchObject({
    status: "unknown",
  });
});

test("EXPO-17 an emergency launch is a fact of the running bundle, read as the SDK reports it", async () => {
  const { updates } = fakeUpdates({
    updateId: UPDATE_A,
    isEmbeddedLaunch: true,
    isEmergencyLaunch: true,
  });

  expect((await expoBundle({ updates })({ scope: SCOPE })).raw).toMatchObject({
    embedded: true,
    emergency: true,
  });
});
