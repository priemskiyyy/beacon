import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { BeaconProvider } from "src/context/BeaconProvider";
import { createWebBeacon } from "src/beacon.fixture";
import { useRoute } from "src/hooks/useRoute";
import { useRunning } from "src/hooks/useRunning";

const create = () => {
  const context = createWebBeacon();

  const View = () => {
    const observation = useRoute(
      "web",
      ({ observation }) => observation.status,
    );

    const running = useRunning(({ web }) => web.state);

    return <span>{`${observation}/${running}`}</span>;
  };

  const view = (
    <BeaconProvider beacon={context.beacon} start>
      <View />
    </BeaconProvider>
  );

  return { ...context, view };
};

test("the server renders the route as not checked and what runs as pending, and starts nothing", () => {
  const { beacon, view, mock } = create();

  expect(renderToString(view)).toContain("unknown/pending");
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
});

test("BIND-08 hydrating the server markup does not mismatch, and the session starts after hydration", async () => {
  const { beacon, view } = create();
  const markup = renderToString(view);
  const container = document.createElement("div");
  const errors: unknown[] = [];

  container.innerHTML = markup;

  await act(async () => {
    hydrateRoot(container, view, {
      onRecoverableError: (error) => errors.push(error),
    });
    await Promise.resolve();
  });

  expect(errors).toEqual([]);
  expect(beacon.status.get()).toMatchObject({ state: "running" });
});

test("BIND-08 a boundary that hydrates after the session started still matches the server markup", async () => {
  const { beacon, view } = create();
  const markup = renderToString(view);
  const container = document.createElement("div");
  const errors: unknown[] = [];

  container.innerHTML = markup;

  // What runs is known before the boundary hydrates, so the live state differs from the markup.
  await act(async () => {
    beacon.start();
    await Promise.resolve();
  });

  expect(beacon.running.get().web.state).toBe("known");

  await act(async () => {
    hydrateRoot(container, view, {
      onRecoverableError: (error) => errors.push(error),
    });
    await Promise.resolve();
  });

  expect(errors).toEqual([]);
  // Hydration read the markup's snapshot, and the render after it read the live one.
  expect(container.textContent).toBe("unknown/known");
});

test("BIND-09 two server requests for different accounts share no session and no state", () => {
  const first = create();
  const second = create();

  first.beacon.start();

  expect(renderToString(second.view)).toContain("unknown/pending");
  expect(second.beacon.status.get()).toEqual({ state: "idle" });
  expect(first.beacon.status.get()).toMatchObject({ state: "running" });
  expect(second.mock.stats().reads).toBe(0);
});
