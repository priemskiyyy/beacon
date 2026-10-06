import { render } from "svelte/server";
import { expect, test } from "vitest";
import { createWebBeacon, settle } from "../beacon.fixture.js";
import { STATUS_MARKUP } from "./serverMarkup.fixture.js";
import StatusHarness from "./StatusHarness.fixture.svelte";

test("the server renders the route as not checked and what runs as pending, and starts nothing", () => {
  expect(typeof window).toBe("undefined");

  const { beacon, mock } = createWebBeacon();

  expect(render(StatusHarness, { props: { beacon } }).body).toBe(STATUS_MARKUP);
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
});

test("a server render reads the value before any session, whatever the Beacon has learned since", async () => {
  const { beacon } = createWebBeacon();

  beacon.start();
  await settle();

  expect(beacon.running.get().web.state).toBe("known");
  expect(render(StatusHarness, { props: { beacon } }).body).toBe(STATUS_MARKUP);
});

test("BIND-09 two server requests for different accounts share no session and no state", () => {
  const first = createWebBeacon();
  const second = createWebBeacon();

  first.beacon.start();

  expect(render(StatusHarness, { props: { beacon: second.beacon } }).body).toBe(
    STATUS_MARKUP,
  );
  expect(second.beacon.status.get()).toEqual({ state: "idle" });
  expect(first.beacon.status.get()).toMatchObject({ state: "running" });
  expect(second.mock.stats().reads).toBe(0);
});
