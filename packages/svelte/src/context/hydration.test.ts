import { settle } from "@priemskiyyy/beacon/mock";
import { flushSync, hydrate, unmount } from "svelte";
import { afterEach, expect, test, vi } from "vitest";
import { createWebBeacon } from "../beacon.fixture.js";
import { STATUS_MARKUP } from "./serverMarkup.fixture.js";
import StatusHarness from "./StatusHarness.fixture.svelte";

afterEach(() => {
  document.body.replaceChildren();
});

const mountServerMarkup = () => {
  const target = document.body.appendChild(document.createElement("div"));

  target.innerHTML = STATUS_MARKUP;

  return target;
};

test("BIND-08 hydrating the server markup does not mismatch, and the session starts before the children read", () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");
  const { beacon } = createWebBeacon();
  const seen: string[] = [];
  const target = mountServerMarkup();

  const app = hydrate(StatusHarness, { target, props: { beacon, seen } });

  flushSync();

  expect(warn.mock.calls).toEqual([]);
  expect(error.mock.calls).toEqual([]);
  expect(seen).toEqual(["unknown/pending"]);
  expect(beacon.status.get()).toMatchObject({ state: "running" });

  unmount(app);
});

test("BIND-08 a boundary that hydrates after the session started still matches the server markup", async () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");
  const { beacon } = createWebBeacon();
  const seen: string[] = [];
  const target = mountServerMarkup();

  // What runs is known before the boundary hydrates, so the live state differs from the markup.
  beacon.start();
  await settle();

  expect(beacon.running.get().web.state).toBe("known");

  const app = hydrate(StatusHarness, { target, props: { beacon, seen } });

  flushSync();

  expect(warn.mock.calls).toEqual([]);
  expect(error.mock.calls).toEqual([]);
  // Hydration read the markup's value, and the render after it read the live one.
  expect(seen).toEqual(["unknown/pending"]);
  expect(target.textContent).toBe("unknown/known");

  unmount(app);
});
