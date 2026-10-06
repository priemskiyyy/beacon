import { expect, test } from "vitest";

import { appStoreHandoff } from "src/appStoreHandoff";
import { APP_STORE_DISTRIBUTION } from "src/utils/constants/lookup";
import { APP_ID, fakeLinking, SCOPE } from "src/fakeStore.fixture";

test("creating the mechanism opens nothing", () => {
  const { opened, linking } = fakeLinking();

  appStoreHandoff({ appId: APP_ID, linking });

  expect(opened).toEqual([]);
});

test("STORE-07 the store page is built from the configured id alone", async () => {
  const { opened, linking } = fakeLinking();
  const mechanism = appStoreHandoff({ appId: APP_ID, linking });
  const { native } = mechanism.open({ scope: SCOPE });

  await mechanism.commands.openStore.run({
    native,
    signal: new AbortController().signal,
    parameters: {},
    offer: null,
  });

  expect(opened).toEqual([`https://apps.apple.com/app/id${APP_ID}`]);
});

test("an id that is not a number is refused at construction", () => {
  const { linking } = fakeLinking();

  expect(() => appStoreHandoff({ appId: "284882215/../x", linking })).toThrow(
    expect.objectContaining({ code: "INVALID_CONFIGURATION" }),
  );
});

test("opening the store is an external handoff to a store destination, with or without an offer", () => {
  const { linking } = fakeLinking();
  const { commands } = appStoreHandoff({ appId: APP_ID, linking });

  expect(commands.openStore).toMatchObject({
    reference: "optional-offer",
    impacts: ["external-handoff"],
    binding: "store-destination",
  });
});

const runOpenStore = async (distribution: string) => {
  const { opened, linking } = fakeLinking();
  const mechanism = appStoreHandoff({ appId: APP_ID, linking });
  const { native } = mechanism.open({ scope: { ...SCOPE, distribution } });

  const result = await mechanism.commands.openStore.run({
    native,
    signal: new AbortController().signal,
    parameters: {},
    offer: null,
  });

  return { result, opened };
};

test("STORE-09 a session of another distribution opens nothing, and says so, for a build the store does not serve", async () => {
  for (const distribution of ["google-play", "development", "testflight", ""]) {
    const { result, opened } = await runOpenStore(distribution);

    expect(result).toEqual({
      status: "unsupported",
      reason: "other-distribution",
    });
    expect(opened).toEqual([]);
  }
});

test("the session of the App Store distribution opens the store, and the distribution is the constant the package exports", async () => {
  const { result, opened } = await runOpenStore(APP_STORE_DISTRIBUTION);

  expect(result).toMatchObject({ status: "accepted" });
  expect(opened).toHaveLength(1);
  expect(APP_STORE_DISTRIBUTION).toBe("app-store");
});

test("the native handle names the link opener and the distribution of the session", () => {
  const { linking } = fakeLinking();

  expect(
    appStoreHandoff({ appId: APP_ID, linking }).open({
      scope: { ...SCOPE, distribution: "testflight" },
    }).native,
  ).toEqual({ linking, distribution: "testflight" });
});
