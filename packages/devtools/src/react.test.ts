import { BeaconError } from "@priemskiyyy/beacon";
import { settle } from "@priemskiyyy/beacon/mock";
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { fireEvent, within } from "@testing-library/dom";
import { cleanup, render } from "@testing-library/react";
import { StrictMode, createElement } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { createLabBeacon } from "src/beacon.fixture";
import type { LabBeacon } from "src/beacon.fixture";
import { BeaconDevtools } from "src/react";
import { spyOnBeacon } from "src/spyOnBeacon.fixture";
import type { BeaconDevtoolsProps } from "src/types/BeaconDevtoolsProps";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

const tree = (
  beacon: LabBeacon,
  props: BeaconDevtoolsProps = { initialIsOpen: true },
  start = false,
) =>
  createElement(
    StrictMode,
    null,
    createElement(
      BeaconProvider,
      { beacon, start },
      createElement(BeaconDevtools, props),
    ),
  );

const inspector = (container: HTMLElement) => {
  const root = container.querySelector("[data-beacon-devtools]")?.shadowRoot
    ?.firstElementChild;

  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected the devtools root inside the shadow root");
  }

  return within(root);
};

const eventTypes = (container: HTMLElement) =>
  Array.from(
    inspector(container)
      .getByLabelText("Event timeline")
      .querySelectorAll(".event-type"),
    (type) => type.textContent,
  );

test("Strict Mode mounts one inspector for the provider's Beacon, and unmounting leaves no listener behind", () => {
  const { beacon, mock, commands } = createLabBeacon();
  const spy = spyOnBeacon(beacon);
  const view = render(tree(spy.beacon));

  expect(
    view.container.querySelectorAll("[data-beacon-devtools]"),
  ).toHaveLength(1);
  expect(
    inspector(view.container).getByRole("complementary", {
      name: "Beacon devtools",
    }).tagName,
  ).toBe("ASIDE");
  expect(spy.live).toMatchObject({
    status: 1,
    events: 1,
    diagnostics: 1,
    routes: 3,
  });

  // The wrapper observes: nothing starts, reads or runs.
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
  expect(commands).toEqual({ reloads: 0, prefetches: 0, downloads: 0 });

  view.unmount();

  expect(spy.subscriptions()).toBe(0);
  expect(view.container.querySelector("[data-beacon-devtools]")).toBeNull();
});

test("the wrapper follows what the provider holds: a session it starts, and then a replaced Beacon", async () => {
  const first = createLabBeacon();
  const second = createLabBeacon();
  const firstSpy = spyOnBeacon(first.beacon);
  const secondSpy = spyOnBeacon(second.beacon);
  const view = render(tree(firstSpy.beacon, { initialIsOpen: true }, true));

  await settle();

  // Strict Mode may start the session more than once; the header says whichever number stands.
  const sessionOf = (beacon: LabBeacon) => {
    const status = beacon.status.get();

    if (status.state !== "running") {
      throw new Error("Expected a running session.");
    }

    return status.session;
  };

  expect(inspector(view.container).getByRole("banner").textContent).toContain(
    `running, session ${sessionOf(first.beacon)}`,
  );

  view.rerender(tree(secondSpy.beacon, { initialIsOpen: true }, true));
  await settle();

  expect(
    view.container.querySelectorAll("[data-beacon-devtools]"),
  ).toHaveLength(1);
  expect(firstSpy.subscriptions()).toBe(0);
  expect(secondSpy.live).toMatchObject({ status: 1, events: 1, routes: 3 });
  expect(inspector(view.container).getByRole("banner").textContent).toContain(
    `running, session ${sessionOf(second.beacon)}`,
  );

  view.unmount();
  expect(secondSpy.subscriptions()).toBe(0);
});

test("a rerender keeps the mounted inspector and its state, and a new maxEvents trims what it keeps", async () => {
  const lab = createLabBeacon();
  const view = render(tree(lab.beacon, { initialIsOpen: true }, true));

  lab.answer();
  await lab.beacon.check();
  await settle();

  const search = () =>
    inspector(view.container).getByRole("searchbox", { name: "Filter events" });

  fireEvent.input(search(), { target: { value: "read" } });
  expect(eventTypes(view.container).length).toBeGreaterThan(3);

  view.rerender(tree(lab.beacon, { initialIsOpen: true, maxEvents: 3 }, true));
  await settle();

  expect(
    view.container.querySelectorAll("[data-beacon-devtools]"),
  ).toHaveLength(1);
  expect(search()).toHaveProperty("value", "read");
  expect(eventTypes(view.container).length).toBeLessThanOrEqual(3);
  expect(inspector(view.container).getByText(/ \/ 3$/)).toBeTruthy();
  view.unmount();
});

test("without props the inspector starts closed and opens from its launcher", () => {
  const { beacon } = createLabBeacon();
  const view = render(tree(beacon, {}));

  expect(inspector(view.container).queryByRole("complementary")).toBeNull();
  fireEvent.click(
    inspector(view.container).getByRole("button", {
      name: "Open Beacon devtools",
    }),
  );
  expect(inspector(view.container).getByRole("complementary")).toBeTruthy();
  view.unmount();
});

test("outside a BeaconProvider the wrapper says so with a BeaconError", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  expect(() => render(createElement(BeaconDevtools))).toThrow(BeaconError);
  expect(() => render(createElement(BeaconDevtools))).toThrow(/BeaconProvider/);
});
