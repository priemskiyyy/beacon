import { fireEvent, within } from "@testing-library/dom";
import { afterEach, expect, test } from "vitest";

import { SECRETS, buildDocument, createLabBeacon } from "src/beacon.fixture";
import { mountDevtools, settle } from "src/mountDevtools.fixture";
import { stubClipboard } from "src/stubClipboard.fixture";
import { PREFERENCES_KEY } from "src/utils/constants/defaults";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

type Mounted = ReturnType<typeof mountDevtools>;

// No secret the application holds may show anywhere in the panel, whatever is toggled.
const expectNoSecrets = ({ text }: Mounted) => {
  for (const secret of Object.values(SECRETS)) {
    expect(text()).not.toContain(secret);
  }
};

const startedLab = async () => {
  const lab = createLabBeacon();

  lab.answer(buildDocument());
  lab.beacon.start();
  await lab.beacon.check();
  await settle();

  return lab;
};

const toggle = ({ view }: Mounted) =>
  view().getByRole("checkbox", { name: "Show raw values" });

test("the raw values of what runs stay hidden until asked for, and a property named like a secret is replaced even then", async () => {
  const { beacon } = await startedLab();
  const mounted = mountDevtools({ beacon, initialIsOpen: true });
  const { view, devtools } = mounted;
  const running = () => view().getByRole("region", { name: "Running" });

  expect(running().textContent).toContain("Raw values hidden.");
  expect(running().querySelector(".raw")).toBeNull();
  expectNoSecrets(mounted);

  fireEvent.click(toggle(mounted));

  const raws = Array.from(running().querySelectorAll(".raw"), (raw) =>
    JSON.parse(raw.textContent ?? "null"),
  );

  expect(raws).toEqual([
    { build: 100, versionName: "1.0.0", apiToken: "[Redacted]" },
    { revision: "abc", cookie: "[Redacted]" },
  ]);
  expectNoSecrets(mounted);

  fireEvent.click(toggle(mounted));
  expect(running().querySelector(".raw")).toBeNull();
  expect(running().textContent).toContain("Raw values hidden.");
  expectNoSecrets(mounted);
  devtools.unmount();
});

test("a provider's handle stays hidden until asked for, and secret-named properties are replaced at any depth", async () => {
  const { beacon } = await startedLab();
  const mounted = mountDevtools({ beacon, initialIsOpen: true });
  const { view, devtools } = mounted;

  fireEvent.click(view().getByRole("button", { name: /^ota/ }));

  const native = () => view().getByRole("region", { name: "Native handle" });

  expect(native().textContent).toContain("Hidden.");
  expect(native().querySelector("pre")).toBeNull();
  expectNoSecrets(mounted);

  fireEvent.click(toggle(mounted));

  expect(
    JSON.parse(native().querySelector("pre")?.textContent ?? "null"),
  ).toEqual({
    label: "fake provider",
    apiToken: "[Redacted]",
    nested: { password: "[Redacted]", channel: "stable" },
  });
  expectNoSecrets(mounted);

  // A feed route's handle is whatever its mechanism opened, here nothing.
  fireEvent.click(view().getByRole("button", { name: /^web/ }));
  expect(
    JSON.parse(native().querySelector("pre")?.textContent ?? "null"),
  ).toEqual({});
  expectNoSecrets(mounted);
  devtools.unmount();
});

test("a route has no handle while no session is open", () => {
  const { beacon } = createLabBeacon();
  const mounted = mountDevtools({ beacon, initialIsOpen: true });

  fireEvent.click(mounted.view().getByRole("button", { name: /^ota/ }));
  fireEvent.click(toggle(mounted));

  expect(
    mounted.view().getByRole("region", { name: "Native handle" }).textContent,
  ).toContain("No open session holds a handle");
  mounted.devtools.unmount();
});

test("the handle follows the session: it appears once one opens", async () => {
  const lab = createLabBeacon();
  const mounted = mountDevtools({ beacon: lab.beacon, initialIsOpen: true });

  fireEvent.click(mounted.view().getByRole("button", { name: /^ota/ }));
  fireEvent.click(toggle(mounted));

  const native = () =>
    mounted.view().getByRole("region", { name: "Native handle" });

  expect(native().querySelector("pre")?.textContent).toContain(
    "No open session holds a handle",
  );

  lab.beacon.start();
  await settle();

  expect(native().querySelector("pre")?.textContent).toContain("fake provider");
  expectNoSecrets(mounted);
  mounted.devtools.unmount();
});

test("copying the handle copies the redacted text, never a secret", async () => {
  const clipboard = stubClipboard();
  const { beacon } = await startedLab();
  const mounted = mountDevtools({ beacon, initialIsOpen: true });

  fireEvent.click(mounted.view().getByRole("button", { name: /^ota/ }));
  fireEvent.click(toggle(mounted));

  const native = mounted.view().getByRole("region", { name: "Native handle" });

  fireEvent.click(within(native).getByRole("button", { name: "Copy" }));
  await settle();

  expect(clipboard.writes).toHaveLength(1);
  expect(clipboard.writes[0]).toBe(native.querySelector("pre")?.textContent);
  expect(clipboard.writes[0]).toContain("[Redacted]");

  for (const secret of Object.values(SECRETS)) {
    expect(clipboard.writes[0]).not.toContain(secret);
  }

  mounted.devtools.unmount();
  clipboard.restore();
});

test("showing raw values is never stored, so a new mount hides them again", async () => {
  const { beacon } = await startedLab();
  const first = mountDevtools({ beacon, initialIsOpen: true });

  fireEvent.click(toggle(first));
  fireEvent.click(first.view().getByRole("button", { name: "Close devtools" }));
  fireEvent.click(
    first.view().getByRole("button", { name: "Open Beacon devtools" }),
  );
  expect(toggle(first)).toHaveProperty("checked", true);
  expect(localStorage.getItem(PREFERENCES_KEY)).not.toMatch(/raw/i);
  first.devtools.unmount();

  const second = mountDevtools({ beacon, initialIsOpen: true });

  expect(toggle(second)).toHaveProperty("checked", false);
  second.devtools.unmount();
});
