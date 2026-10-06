import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { rolldown } from "rolldown";

// The built browser triggers in a real browser: `reconnect` over the `online` event that Chromium fires when its network really goes away and comes back, and the check at startup of `checkOn`. A hidden tab and the back-forward cache cannot be made in a headless page, so `foreground` is only run over a fake page, by its unit tests.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CORE = path.join(ROOT, "packages/core/dist/index.js");
const TRIGGERS = path.join(ROOT, "packages/adapters/triggers/dist/index.js");
const BROWSER = path.join(ROOT, "packages/adapters/triggers/dist/browser.js");

const lab = { code: "", folder: "" };

test.beforeAll(async () => {
  lab.folder = mkdtempSync(path.join(tmpdir(), "beacon-triggers-browser-"));

  const entry = path.join(lab.folder, "entry.mjs");

  writeFileSync(
    entry,
    `export { Beacon, createReleaseSource, createUpdateMechanism, targetRoute } from ${JSON.stringify(CORE)};\nexport { checkOn } from ${JSON.stringify(TRIGGERS)};\nexport { foreground, reconnect } from ${JSON.stringify(BROWSER)};\n`,
  );

  const bundle = await rolldown({ input: entry, logLevel: "silent" });
  const { output } = await bundle.generate({ format: "iife", name: "Lab" });

  await bundle.close();

  lab.code = output
    .flatMap((item) => {
      if (item.type !== "chunk") {
        return [];
      }

      return [item.code];
    })
    .join("\n");
});

test.afterAll(() => {
  rmSync(lab.folder, { recursive: true, force: true });
});

// A Beacon over a source that always offers a build, whose checks are listed by the reason they were started for.
const APP = `
window.reasons = [];
// How many online listeners the page holds, which only the triggers under test add.
window.onlineListeners = 0;
const add = window.addEventListener.bind(window);
const remove = window.removeEventListener.bind(window);
window.addEventListener = (type, listener, options) => {
  if (type === "online") { window.onlineListeners += 1; }
  return add(type, listener, options);
};
window.removeEventListener = (type, listener, options) => {
  if (type === "online") { window.onlineListeners -= 1; }
  return remove(type, listener, options);
};
window.watch = (options) => {
  const source = Lab.createReleaseSource({ name: "manifest", read: async () => ({ document: { kind: "none", reason: "up-to-date" } }) });
  const mechanism = Lab.createUpdateMechanism({ name: "inert", subject: "web", open: () => ({ native: {} }), commands: {} });
  const beacon = new Lab.Beacon({
    scope: { application: "com.example.notes", environment: "production", platform: "web", distribution: "public-web" },
    running: { web: () => ({ identity: { status: "known", authority: "com.example.notes", domain: "web-artifact", value: "a" }, label: "a", raw: {} }) },
    routes: { web: Lab.targetRoute({ source: source.select((document) => document), mechanism }) },
  });
  beacon.diagnostics.events.subscribe((event) => { if (event.type === "check-started") { window.reasons.push(event.reason); } });
  window.stopChecking = Lab.checkOn(beacon, options(Lab));
  window.beforeStart = window.onlineListeners;
  window.beacon = beacon;
  beacon.start();
};
`;

const open = async (page: Page, options: string) => {
  await page.setContent("<!doctype html><title>triggers</title>");
  await page.addScriptTag({ content: lab.code });
  await page.addScriptTag({ content: APP });
  await page.evaluate(`window.watch((Lab) => (${options}))`);
};

const reasons = (page: Page) => page.evaluate("window.reasons");

test("checkOn checks once at startup in a real browser, with no trigger to list for it", async ({
  page,
}) => {
  await open(page, "({ triggers: [] })");
  await expect.poll(() => reasons(page)).toEqual(["startup"]);
});

test("startup false leaves the first check to the triggers, so a page that loads online checks nothing", async ({
  page,
}) => {
  await open(
    page,
    "({ startup: false, triggers: [Lab.reconnect(), Lab.foreground()] })",
  );
  await page.waitForTimeout(300);

  expect(await reasons(page)).toEqual([]);
});

test("the online event of a real browser is a reconnect: Chromium goes offline and back, and the page checks once, for the reconnect", async ({
  context,
  page,
}) => {
  await open(page, "({ startup: false, triggers: [Lab.reconnect()] })");

  await context.setOffline(true);
  await page.waitForTimeout(200);
  expect(await reasons(page)).toEqual([]);

  await context.setOffline(false);
  await expect.poll(() => reasons(page)).toEqual(["reconnect"]);
});

test("the page is listened to only while a session is open, and stopping takes the listener back", async ({
  page,
}) => {
  await open(page, "({ startup: false, triggers: [Lab.reconnect()] })");

  expect(await page.evaluate("window.beforeStart")).toBe(0);
  expect(await page.evaluate("window.onlineListeners")).toBe(1);

  await page.evaluate("window.stopChecking()");

  expect(await page.evaluate("window.onlineListeners")).toBe(0);
});
