import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { BeaconProvider } from "src/context/BeaconProvider";
import { createWebBeacon } from "src/beacon.fixture";
import { useRoute } from "src/hooks/useRoute";
import { useRunning } from "src/hooks/useRunning";

const create = () => {
  const context = createWebBeacon();
  const web = context.beacon.route("web");

  const View = () => {
    const observation = useRoute(web, ({ observation }) => observation.status);
    const running = useRunning(context.beacon, ({ web }) => web.state);

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

test("hydrating the server markup does not mismatch, and the session starts after hydration", async () => {
  const { beacon, view } = create();
  const markup = renderToString(view);
  const container = document.createElement("div");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});

  container.innerHTML = markup;

  await act(async () => {
    hydrateRoot(container, view);
    await Promise.resolve();
  });

  expect(errors).not.toHaveBeenCalled();
  expect(beacon.status.get()).toMatchObject({ state: "running" });
});
