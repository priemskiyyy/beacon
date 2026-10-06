import { settle } from "src/mock/settle";
import { expect, test } from "vitest";

import { checkOn } from "src/triggers/checkOn";
import { createTestBeacon, deploy } from "src/triggers/checkOn.fixture";
import { fakeChannel } from "src/triggers/fakeSources.fixture";
import { invalidation } from "src/triggers/invalidation";

test("TRIG-29 a push checks once, for the invalidation, and what the authority says decides what is offered", async () => {
  const { beacon, mock, reasons } = createTestBeacon();
  const channel = fakeChannel();

  // The push may announce anything: the running build is what the authority still publishes.
  mock.answer({ document: deploy("update-1") });

  const stop = checkOn(beacon, {
    startup: false,
    triggers: [invalidation({ source: channel.source })],
  });

  beacon.start();

  expect(channel.listeners()).toBe(1);

  channel.push();
  await settle();

  expect(reasons()).toEqual(["invalidation"]);
  expect(beacon.route("bundle").state.get().observation).toMatchObject({
    status: "none",
    reason: "same-identity",
  });

  stop();

  expect(channel.listeners()).toBe(0);
});
