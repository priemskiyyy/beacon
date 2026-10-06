import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { BeaconError } from "@priemskiyyy/beacon";
import { settle } from "@priemskiyyy/beacon/mock";
import { fireEvent } from "@testing-library/dom";
import { afterEach, expect, test } from "vitest";

import { createLabBeacon } from "src/beacon.fixture";
import type * as sources from "src/index";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

const built = join(import.meta.dirname, "..", "dist", "index.js");

// Imported as a host application gets it, from the package's own build, not from the sources.
const load = async (): Promise<typeof sources> =>
  import(pathToFileURL(built).href);

test("the built inspector carries its own Solid and imports nothing but the core", () => {
  const imports = Array.from(
    readFileSync(built, "utf8").matchAll(
      /(?:from\s*|import\s*\(\s*|import\s+)["']([^"'.][^"']*)["']/g,
    ),
    (match) => match[1],
  );

  expect(imports).toEqual(["@priemskiyyy/beacon"]);
});

test("the built inspector mounts in a shadow root, shows a Beacon and lets go of it, without a Solid of the host", async () => {
  const { BeaconDevtools } = await load();
  const lab = createLabBeacon();
  const host = document.body.appendChild(document.createElement("div"));
  const devtools = new BeaconDevtools({ beacon: lab.beacon });

  devtools.mount(host);

  const launcher = host.shadowRoot?.querySelector<HTMLElement>(".launcher");

  expect(launcher?.getAttribute("aria-label")).toBe("Open Beacon devtools");
  fireEvent.click(launcher ?? host);

  lab.answer();
  lab.beacon.start();
  await lab.beacon.check();
  await settle();

  const rows = Array.from(
    host.shadowRoot?.querySelectorAll(".row-title") ?? [],
    (row) => row.textContent,
  );

  expect(rows).toEqual(["Overview", "web", "binary", "ota"]);
  expect(host.shadowRoot?.textContent).toContain("running, session 1");

  // The bundle shares the core of its host: its error is the host's own.
  expect(() => devtools.mount(host)).toThrow(BeaconError);

  devtools.unmount();
  expect(host.shadowRoot?.childElementCount).toBe(0);
});
