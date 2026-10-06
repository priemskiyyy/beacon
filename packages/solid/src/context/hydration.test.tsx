import { hydrate } from "solid-js/web";
import { afterEach, expect, test, vi } from "vitest";

import { createWebBeacon } from "src/beacon.fixture";
import { STATUS_MARKUP } from "src/context/serverMarkup.fixture";
import { StatusView } from "src/context/View.fixture";
import { settle } from "src/settle.fixture";

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(globalThis, "_$HY");
});

// Solid hydrates through the global that the page's hydration script creates, so the test creates it.
const prepare = () => {
  const target = document.body.appendChild(document.createElement("div"));

  target.innerHTML = STATUS_MARKUP;

  Object.assign(globalThis, {
    _$HY: { events: [], completed: new WeakSet(), r: {}, fe: () => {} },
  });

  return target;
};

test("BIND-08 hydrating the server markup keeps the server's node, and the session starts after hydration", () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");
  const { beacon } = createWebBeacon();
  const target = prepare();
  const rendered = target.firstChild;

  const dispose = hydrate(() => <StatusView beacon={beacon} />, target);

  expect(target.childNodes).toHaveLength(1);
  expect(target.firstChild).toBe(rendered);
  expect(warn.mock.calls).toEqual([]);
  expect(error.mock.calls).toEqual([]);
  expect(beacon.status.get()).toMatchObject({ state: "running" });

  dispose();
});

test("BIND-08 a boundary that hydrates after the session started still matches the server markup, then shows what the client knows", async () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");
  const { beacon } = createWebBeacon();

  beacon.start();
  await settle();

  // What runs is known before the boundary hydrates, so the live state differs from the markup.
  expect(beacon.running.get().web.state).toBe("known");

  const target = prepare();
  const rendered = target.firstChild;

  const dispose = hydrate(() => <StatusView beacon={beacon} />, target);

  expect(target.childNodes).toHaveLength(1);
  expect(target.firstChild).toBe(rendered);
  expect(warn.mock.calls).toEqual([]);
  expect(error.mock.calls).toEqual([]);
  // Hydration claimed the markup's snapshot, and the render after mount read the live one.
  expect(target.textContent).toBe("unknown/known");

  dispose();
});

test("a hydrated view follows the Beacon after mount", async () => {
  const { beacon } = createWebBeacon();
  const target = prepare();

  const dispose = hydrate(() => <StatusView beacon={beacon} />, target);

  expect(target.textContent).toBe("unknown/pending");

  await settle();

  expect(target.textContent).toBe("unknown/known");

  dispose();
});
