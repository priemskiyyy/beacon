import { BeaconError } from "@priemskiyyy/beacon";
import { fireEvent, within } from "@testing-library/dom";
import { afterEach, expect, test, vi } from "vitest";

import { createLabBeacon } from "src/beacon.fixture";
import { createEmittingBeacon } from "src/emittingBeacon.fixture";
import { mountDevtools, settle } from "src/mountDevtools.fixture";
import { spyOnBeacon } from "src/spyOnBeacon.fixture";
import { PREFERENCES_KEY } from "src/utils/constants/defaults";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

const stored = () => JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "null");

const rowCount = (view: ReturnType<typeof mountDevtools>["view"]) =>
  view().queryAllByRole("group", { name: "Event types" }).length === 0
    ? 0
    : (view().queryByLabelText("Event timeline")?.querySelectorAll("details")
        .length ?? 0);

test("mounting the panel observes a Beacon and starts, reads and runs nothing", () => {
  const { beacon, mock, commands, journal } = createLabBeacon();
  const { view, devtools } = mountDevtools({ beacon, initialIsOpen: true });

  expect(
    view().getByRole("complementary", { name: "Beacon devtools" }),
  ).toBeTruthy();
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
  expect(commands).toEqual({ reloads: 0, prefetches: 0, downloads: 0 });
  expect(journal.size).toBe(0);
  devtools.unmount();
});

test("a Beacon with the devtools mounted ends in the same state as one without", async () => {
  const observed = createLabBeacon();
  const alone = createLabBeacon();

  const { devtools } = mountDevtools({
    beacon: observed.beacon,
    initialIsOpen: true,
  });

  for (const lab of [observed, alone]) {
    lab.answer();
    lab.beacon.start();
    await lab.beacon.check({ reason: "startup" });
    lab.clock.advance(1_000);
  }

  for (const name of alone.beacon.routeNames) {
    expect(observed.beacon.route(name).state.get()).toEqual(
      alone.beacon.route(name).state.get(),
    );
  }

  expect(observed.beacon.running.get()).toEqual(alone.beacon.running.get());
  expect(observed.beacon.support.get()).toEqual(alone.beacon.support.get());
  expect(observed.beacon.transitions.get()).toEqual(
    alone.beacon.transitions.get(),
  );
  expect(observed.beacon.diagnostics.get()).toEqual(
    alone.beacon.diagnostics.get(),
  );
  expect(observed.mock.stats()).toEqual(alone.mock.stats());
  devtools.unmount();
});

test("mounting twice throws a BeaconError, unmounting twice is harmless, and the events survive an unmount", async () => {
  const { beacon } = createLabBeacon();
  const { devtools, host, view } = mountDevtools({
    beacon,
    initialIsOpen: true,
  });

  expect(() => devtools.mount(host)).toThrow(BeaconError);
  expect(() => devtools.mount(host)).toThrow(/already mounted/);

  beacon.start();
  await settle();
  expect(rowCount(view)).toBeGreaterThan(0);
  const recorded = rowCount(view);

  devtools.unmount();
  devtools.unmount();
  expect(host.shadowRoot?.childElementCount).toBe(0);

  devtools.mount(host);
  expect(rowCount(view)).toBe(recorded);
  devtools.unmount();
});

test("every subscription lives only while it is needed and none is left behind", () => {
  const { beacon } = createLabBeacon();
  const spy = spyOnBeacon(beacon);
  const { devtools, view } = mountDevtools({ beacon: spy.beacon });

  // Closed, only the launcher's status and the recording of events.
  expect(spy.live).toEqual({
    status: 1,
    running: 0,
    support: 0,
    transitions: 0,
    diagnostics: 0,
    events: 1,
    routes: 0,
    natives: 0,
  });

  fireEvent.click(view().getByRole("button", { name: "Open Beacon devtools" }));
  expect(spy.live).toMatchObject({
    status: 1,
    running: 1,
    support: 1,
    transitions: 1,
    diagnostics: 1,
    events: 1,
    routes: 3,
    natives: 0,
  });

  // A route's own handle is read only once raw values are asked for.
  fireEvent.click(view().getByRole("button", { name: /^ota/ }));
  expect(spy.live.natives).toBe(0);
  fireEvent.click(view().getByRole("checkbox", { name: "Show raw values" }));
  expect(spy.live.natives).toBe(1);
  fireEvent.click(view().getByRole("checkbox", { name: "Show raw values" }));
  expect(spy.live.natives).toBe(0);

  fireEvent.click(view().getByRole("button", { name: "Pause" }));
  expect(spy.live.events).toBe(0);
  fireEvent.click(view().getByRole("button", { name: "Resume" }));
  expect(spy.live.events).toBe(1);

  fireEvent.click(view().getByRole("button", { name: "Close devtools" }));
  expect(spy.live).toMatchObject({ routes: 0, running: 0, diagnostics: 0 });

  devtools.unmount();
  expect(spy.subscriptions()).toBe(0);
});

test("setBeacon follows another Beacon and lets go of the first", async () => {
  const first = createLabBeacon();
  const second = createLabBeacon();
  const firstSpy = spyOnBeacon(first.beacon);
  const secondSpy = spyOnBeacon(second.beacon);

  const { devtools, view } = mountDevtools({
    beacon: firstSpy.beacon,
    initialIsOpen: true,
  });

  expect(view().getByText("running, session 1", { exact: false })).toBeTruthy;
  first.beacon.start();
  await settle();
  expect(view().getByText("running, session 1")).toBeTruthy();

  devtools.setBeacon(secondSpy.beacon);
  expect(firstSpy.subscriptions()).toBe(0);
  expect(secondSpy.live).toMatchObject({ status: 1, events: 1, routes: 3 });
  expect(view().queryByText("running, session 1")).toBeNull();

  second.beacon.start();
  first.beacon.stop();
  await settle();

  expect(view().getByText("running, session 1")).toBeTruthy();
  devtools.unmount();
  expect(secondSpy.subscriptions()).toBe(0);
});

test("maxEvents is clamped to 1 through 1000, falls back for what is not a number, and setMaxEvents trims", async () => {
  const { beacon } = createLabBeacon();
  const many = async (options: { maxEvents: number }, emitted: number) => {
    const emitting = createEmittingBeacon(beacon);
    const mounted = mountDevtools({
      beacon: emitting.beacon,
      initialIsOpen: true,
      ...options,
    });

    for (let index = 0; index < emitted; index += 1) {
      emitting.emit({ attempt: index });
    }

    await settle();

    return { ...mounted, rows: () => rowCount(mounted.view) };
  };

  const none = await many({ maxEvents: 0 }, 3);

  expect(none.rows()).toBe(1);
  none.devtools.unmount();

  const negative = await many({ maxEvents: -20 }, 3);

  expect(negative.rows()).toBe(1);
  negative.devtools.unmount();

  const huge = await many({ maxEvents: 50_000 }, 1_010);

  expect(huge.rows()).toBe(1_000);
  huge.devtools.unmount();

  const notANumber = await many({ maxEvents: Number.NaN }, 250);

  expect(notANumber.rows()).toBe(200);
  notANumber.devtools.unmount();

  const set = await many({ maxEvents: 10 }, 8);

  expect(set.rows()).toBe(8);
  set.devtools.setMaxEvents(3);
  expect(set.rows()).toBe(3);
  set.devtools.setMaxEvents(0);
  expect(set.rows()).toBe(1);
  set.devtools.unmount();
});

test("the panel starts closed and opens on the first visit only when initialIsOpen says so", () => {
  const { beacon } = createLabBeacon();

  const closed = mountDevtools({ beacon });

  expect(
    closed.view().getByRole("button", { name: "Open Beacon devtools" }),
  ).toBeTruthy();
  expect(closed.view().queryByRole("complementary")).toBeNull();
  // Nothing is written until the person does something.
  expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
  closed.devtools.unmount();

  const open = mountDevtools({ beacon, initialIsOpen: true });

  expect(open.view().getByRole("complementary")).toBeTruthy();
  expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
  // A restored panel never steals focus.
  expect(open.host.shadowRoot?.activeElement).toBeNull();
  open.devtools.unmount();
});

test("the launcher opens the panel, the panel resizes and docks, Escape closes it, and each choice is remembered", () => {
  const { beacon } = createLabBeacon();
  const first = mountDevtools({ beacon });

  fireEvent.click(
    first.view().getByRole("button", { name: "Open Beacon devtools" }),
  );

  const panel = first.view().getByRole("complementary", {
    name: "Beacon devtools",
  });

  expect(first.host.shadowRoot?.activeElement).toBe(panel);
  expect(stored()).toEqual({ isOpen: true });

  const handle = () =>
    first.view().getByRole("separator", { name: "Resize devtools" });

  fireEvent.keyDown(handle(), { key: "ArrowUp" });
  expect(panel.style.height).toBe("444px");
  fireEvent.keyDown(handle(), { key: "ArrowDown" });
  fireEvent.keyDown(handle(), { key: "ArrowDown" });
  expect(panel.style.height).toBe("396px");

  fireEvent.click(
    first.view().getByRole("button", { name: "Dock to the right" }),
  );
  expect(panel.dataset["position"]).toBe("right");
  fireEvent.keyDown(handle(), { key: "ArrowLeft" });
  expect(panel.style.width).toBe("544px");

  fireEvent.click(
    first.view().getByRole("button", { name: "Dock to the bottom" }),
  );
  expect(panel.style.height).toBe("396px");

  fireEvent.keyDown(panel, { key: "Escape" });

  const launcher = first
    .view()
    .getByRole("button", { name: "Open Beacon devtools" });

  expect(first.host.shadowRoot?.activeElement).toBe(launcher);
  expect(stored()).toEqual({
    isOpen: false,
    height: 396,
    width: 544,
    position: "bottom",
  });
  first.devtools.unmount();

  // Later visits restore the last state, whatever the option says.
  localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({ isOpen: true, position: "right", width: 640 }),
  );

  const second = mountDevtools({ beacon });
  const restored = second.view().getByRole("complementary");

  expect(restored.dataset["position"]).toBe("right");
  expect(restored.style.width).toBe("640px");
  second.devtools.unmount();

  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ isOpen: false }));

  const third = mountDevtools({ beacon, initialIsOpen: true });

  expect(
    third.view().getByRole("button", { name: "Open Beacon devtools" }),
  ).toBeTruthy();
  third.devtools.unmount();
});

test("preferences that are corrupted, mistyped or out of range are ignored, field by field", () => {
  const { beacon } = createLabBeacon();

  for (const raw of [
    "{",
    "null",
    "[1, 2]",
    '"open"',
    JSON.stringify({ isOpen: "yes", position: "top", height: -5, width: 1.5 }),
  ]) {
    localStorage.setItem(PREFERENCES_KEY, raw);

    const { devtools, view } = mountDevtools({ beacon });

    expect(
      view().getByRole("button", { name: "Open Beacon devtools" }),
    ).toBeTruthy();
    fireEvent.click(view().getByRole("button", { name: "Open Beacon devtools" }));

    const panel = view().getByRole("complementary");

    expect(panel.dataset["position"]).toBe("bottom");
    expect(panel.style.height).toBe("420px");
    devtools.unmount();
  }

  localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({ isOpen: true, position: "sideways", height: 300 }),
  );

  const partly = mountDevtools({ beacon });
  const panel = partly.view().getByRole("complementary");

  expect(panel.dataset["position"]).toBe("bottom");
  expect(panel.style.height).toBe("300px");
  partly.devtools.unmount();
});

test("storage that throws leaves the panel working with the defaults", () => {
  const { beacon } = createLabBeacon();

  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });

  const { devtools, view } = mountDevtools({ beacon, initialIsOpen: true });
  const panel = view().getByRole("complementary");

  fireEvent.keyDown(within(panel).getByRole("separator"), { key: "ArrowUp" });
  expect(panel.style.height).toBe("444px");
  fireEvent.keyDown(panel, { key: "Escape" });
  expect(
    view().getByRole("button", { name: "Open Beacon devtools" }),
  ).toBeTruthy();
  devtools.unmount();
});
