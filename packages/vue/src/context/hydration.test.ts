import { afterEach, expect, test, vi } from "vitest";
import { nextTick } from "vue";
import { renderToString } from "vue/server-renderer";

import { settle } from "src/beacon.fixture";
import { createView } from "src/context/view.fixture";

afterEach(() => {
  document.body.replaceChildren();
});

const attach = (markup: string) => {
  const container = document.body.appendChild(document.createElement("div"));

  container.innerHTML = markup;

  return container;
};

test("BIND-08 hydrating the server markup does not mismatch, and the session starts after hydration", async () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");
  const markup = await renderToString(createView().createApp());
  const client = createView();
  const container = attach(markup);
  const app = client.createApp();

  expect(client.beacon.status.get()).toEqual({ state: "idle" });

  app.mount(container);

  expect(client.beacon.status.get()).toMatchObject({ state: "running" });
  expect(container.textContent).toBe("unknown/pending");

  await nextTick();

  expect(warn.mock.calls).toEqual([]);
  expect(error.mock.calls).toEqual([]);

  app.unmount();
});

test("BIND-08 a boundary that hydrates after the session started still matches the server markup", async () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");
  const markup = await renderToString(createView().createApp());
  const client = createView();
  const container = attach(markup);

  // What runs is known before the boundary hydrates, so the live state differs from the markup.
  client.beacon.start();
  await settle();

  expect(client.beacon.running.get().web.state).toBe("known");

  const app = client.createApp();

  app.mount(container);

  // Hydration read the markup's snapshot, and the render after it reads the live one.
  expect(container.textContent).toBe("unknown/pending");

  await nextTick();

  expect(warn.mock.calls).toEqual([]);
  expect(error.mock.calls).toEqual([]);
  expect(container.textContent).toBe("unknown/known");

  app.unmount();
});

test("a client that never hydrated renders the initial value first and the live one right after mount", async () => {
  const client = createView();
  const container = attach("");
  const app = client.createApp();

  client.beacon.start();
  await settle();
  app.mount(container);

  expect(client.beacon.running.get().web.state).toBe("known");

  await nextTick();

  expect(container.textContent).toBe("unknown/known");

  app.unmount();
});
