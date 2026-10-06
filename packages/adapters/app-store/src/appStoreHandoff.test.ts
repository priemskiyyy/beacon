import { expect, test } from "vitest";

import { appStoreHandoff } from "src/appStoreHandoff";
import { APP_ID, fakeLinking } from "src/fakeStore.fixture";

test("creating the mechanism opens nothing", () => {
  const { opened, linking } = fakeLinking();

  appStoreHandoff({ appId: APP_ID, linking });

  expect(opened).toEqual([]);
});

test("STORE-07 the store page is built from the configured id alone", async () => {
  const { opened, linking } = fakeLinking();
  const mechanism = appStoreHandoff({ appId: APP_ID, linking });
  const { native } = mechanism.open();

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
