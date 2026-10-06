import { renderToString } from "solid-js/web";
import { expect, test } from "vitest";

import { createWebBeacon } from "src/beacon.fixture";
import { STATUS_MARKUP } from "src/context/serverMarkup.fixture";
import { StatusView } from "src/context/View.fixture";
import { settle } from "src/settle.fixture";

test("the server renders the route as not checked and what runs as pending, and starts nothing", () => {
  expect(typeof window).toBe("undefined");

  const { beacon, mock } = createWebBeacon();

  expect(renderToString(() => <StatusView beacon={beacon} />)).toBe(
    STATUS_MARKUP,
  );
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
});

test("BIND-08 a server render reads the Beacon as it was before any session, whatever it knows now", async () => {
  const { beacon } = createWebBeacon();

  beacon.start();
  await settle();

  // What runs is known by now, and the server still renders what it was before any session.
  expect(beacon.running.get().web.state).toBe("known");
  expect(renderToString(() => <StatusView beacon={beacon} />)).toBe(
    STATUS_MARKUP,
  );
});

test("BIND-09 two server requests for different accounts share no session and no state", () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  first.beacon.start();

  expect(renderToString(() => <StatusView beacon={second.beacon} />)).toBe(
    STATUS_MARKUP,
  );
  expect(second.beacon.status.get()).toEqual({ state: "idle" });
  expect(first.beacon.status.get()).toMatchObject({ state: "running" });
  expect(second.mock.stats().reads).toBe(0);
});
