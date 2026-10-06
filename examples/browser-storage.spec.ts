import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { rolldown } from "rolldown";
import { build } from "vite";

// The built packages in a real browser: `browserStorage` with a real `location.reload()`, real Web Storage, a real quota and a real sandboxed frame, and `webBuild` over what a real Vite build compiles a missing define to. No example app is involved, so the page is a few lines of its own.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CORE = path.join(ROOT, "packages/core/dist/index.js");
const BROWSER = path.join(ROOT, "packages/adapters/browser/dist/index.js");
const BROWSER_DOCS = path.join(ROOT, "docs/browser.md");

// `delay` holds the answer to the page itself, so the old document is alive while the new one is on its way.
const state = { build: "build-a", delay: 0 };

const lab: {
  code: string;
  folder: string;
  server: Server | null;
  url: string;
} = { code: "", folder: "", server: null, url: "" };

const readBundle = async (folder: string) => {
  const entry = path.join(folder, "entry.mjs");

  writeFileSync(
    entry,
    `export { Beacon, createBootId, createReleaseSource, targetRoute } from ${JSON.stringify(CORE)};\nexport { browserReload, browserStorage, webBuild } from ${JSON.stringify(BROWSER)};\n`,
  );

  const bundle = await rolldown({ input: entry, logLevel: "silent" });
  const { output } = await bundle.generate({ format: "iife", name: "Lab" });

  await bundle.close();

  return output
    .flatMap((item) => {
      if (item.type !== "chunk") {
        return [];
      }

      return [item.code];
    })
    .join("\n");
};

// A Beacon over a manifest that always names build-b, with the journal in the storage under test. The build the page runs is what the server wrote into it, so a real reload after a deploy runs build-b.
const APP = `
const scope = { application: "com.example.notes", environment: "production", platform: "web", distribution: "public-web" };
// What an application has of its own: a draft it will not lose, the prompt it asks for while the draft is dirty, and a participant that closes the draft while a reload is reserved.
window.draft = { dirty: false, guard: "preventDefault" };
addEventListener("beforeunload", (event) => {
  if (!window.draft.dirty) { return; }
  if (window.draft.guard === "returnValue") { event.returnValue = "Unsaved"; return; }
  event.preventDefault();
});
addEventListener("pagehide", () => {
  if (!window.beacon) { return; }
  const { operation } = window.beacon.route("web").state.get();
  document.cookie = "operation-at-pagehide=" + operation.state;
});
window.boot = async (options = {}) => {
  const source = Lab.createReleaseSource({ name: "manifest", read: async () => ({ document: { kind: "target", release: { identity: { status: "known", authority: scope.application, domain: "web-artifact", value: "build-b" }, label: "b" } } }) });
  const beacon = new Lab.Beacon({
    scope,
    running: { boot: { id: Lab.createBootId() }, web: Lab.webBuild({ authority: scope.application, id: BUILD }) },
    routes: { web: Lab.targetRoute({ source: source.select((document) => document), mechanism: Lab.browserReload() }) },
    journal: { mode: "required", storage: Lab.browserStorage(options) },
  });
  window.beacon = beacon;
  const field = document.getElementById("draft");
  field.addEventListener("input", () => { window.draft.dirty = true; });
  // The reserved result says how to reopen the draft by the name the field has today, and by the name the rename gives it.
  beacon.disruptions.register({ name: "draft", impacts: ["document-replacement"], reserve: () => {
    field.readOnly = true;
    const reopen = () => { field.readOnly = false; };
    return { status: "reserved", release: reopen, resume: reopen };
  } });
  beacon.start();
  await new Promise((resolve) => setTimeout(resolve, 80));
  return beacon;
};
window.offer = async () => {
  await window.beacon.check();
  return window.beacon.route("web").state.get().observation.status;
};
window.goReload = () => {
  const { observation } = window.beacon.route("web").state.get();
  window.beacon.route("web").reload({ offer: observation.offer.ref }).then((outcome) => { window.__outcome = outcome; });
};
window.judged = () => {
  const { journal, latest } = window.beacon.transitions.get();
  const web = window.beacon.running.get().web;
  return { journal, outcome: latest === null ? null : latest.outcome, running: web.state === "known" && web.release.identity.status === "known" ? web.release.identity.value : null };
};
`;

// A worker that precaches the page at install and answers every navigation from its cache, as a Workbox precache does for the shell of an app.
const PRECACHING_WORKER = `
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("shell").then((cache) => cache.add("/")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(caches.match("/").then((stored) => stored || fetch(event.request)));
  }
});
`;

// What a sandboxed frame without `allow-same-origin` runs: its origin is opaque, so reading either storage property throws.
const FRAME = `
(async () => {
  const refuse = (error) => ({ message: error.message, cause: error.cause && error.cause.name });
  const read = await Lab.browserStorage().read("k").then(() => "resolved", refuse);
  const write = await Lab.browserStorage({ area: "local" }).write("k", "v").then(() => "resolved", refuse);

  parent.postMessage(JSON.stringify({ read, write }), "*");
})();
`;

test.beforeAll(async () => {
  lab.folder = mkdtempSync(path.join(tmpdir(), "beacon-browser-storage-"));
  lab.code = await readBundle(lab.folder);

  const server = createServer((request, response) => {
    if (request.url === "/deploy") {
      state.build = "build-b";
      response.end("ok");

      return;
    }

    if (request.url === "/sw.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(PRECACHING_WORKER);

      return;
    }

    response.setHeader("content-type", "text/html");

    if (request.url === "/frame") {
      response.end(
        `<!doctype html><title>frame</title><body><script>${lab.code}</script><script>${FRAME}</script></body>`,
      );

      return;
    }

    const page = `<!doctype html><title>storage</title><body><textarea id="draft"></textarea><script>${lab.code}</script><script>const BUILD = ${JSON.stringify(state.build)};${APP}</script></body>`;

    setTimeout(() => response.end(page), state.delay);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("The server has no port.");
  }

  lab.server = server;
  lab.url = `http://127.0.0.1:${address.port}/`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (lab.server === null) {
      resolve();

      return;
    }

    lab.server.close(() => resolve());
  });
  rmSync(lab.folder, { recursive: true, force: true });
});

test.beforeEach(() => {
  state.build = "build-a";
  state.delay = 0;
});

// `options` is what the page hands `browserStorage`, as text of code: nothing, to use its defaults.
const reloadIntoTheDeploy = async (page: Page, options: string) => {
  await page.goto(lab.url);
  await page.evaluate("sessionStorage.clear(); localStorage.clear();");
  await page.evaluate(`window.boot(${options}).then(() => window.offer())`);
  await page.evaluate("fetch('/deploy').then((response) => response.text())");

  const loaded = page.waitForEvent("load");

  await page.evaluate("setTimeout(() => window.goReload(), 0)");
  await loaded;
};

for (const area of ["session", "local"]) {
  test(`a real reload keeps the ${area} storage, so the next boot reads what the last one wrote and says the target runs`, async ({
    page,
  }) => {
    await reloadIntoTheDeploy(page, `{ area: ${JSON.stringify(area)} }`);

    const next = await page.evaluate(
      `window.boot({ area: ${JSON.stringify(area)} }).then(() => window.judged())`,
    );

    expect(next).toEqual({
      journal: "ready",
      outcome: "target-running",
      running: "build-b",
    });
  });

  test(`a new tab has ${area === "session" ? "no record of it" : "the shared record"} in the ${area} storage`, async ({
    context,
    page,
  }) => {
    await reloadIntoTheDeploy(page, `{ area: ${JSON.stringify(area)} }`);

    const tab = await context.newPage();

    await tab.goto(lab.url);

    const fresh = await tab.evaluate(
      `window.boot({ area: ${JSON.stringify(area)} }).then(() => window.judged())`,
    );

    expect(fresh).toMatchObject({
      journal: "ready",
      outcome: area === "session" ? null : "target-running",
    });
  });
}

test("the default keeps the record in the tab's session storage and leaves local storage alone", async ({
  page,
}) => {
  await reloadIntoTheDeploy(page, "");

  const kept = await page.evaluate(
    "({ session: Object.keys(sessionStorage), local: Object.keys(localStorage) })",
  );

  expect(kept).toEqual({
    session: ["beacon/v1/com.example.notes/production/web/public-web"],
    local: [],
  });
});

test("a full localStorage makes the write throw QuotaExceededError, and a required journal stops the reload", async ({
  page,
}) => {
  await page.goto(lab.url);

  const refused = await page.evaluate(`(async () => {
    localStorage.clear();

    const chunk = "x".repeat(1024 * 1024);

    try { for (let i = 0; ; i++) { localStorage.setItem("fill" + i, chunk); } } catch {}

    for (const size of [100000, 10000, 1000, 100, 10, 1]) {
      for (let n = 0; n < 100000; n++) {
        try { localStorage.setItem("pad" + size + "-" + n, "y".repeat(size)); } catch { break; }
      }
    }

    const written = await Lab.browserStorage({ area: "local" }).write("k", "v".repeat(2000)).then(() => "written", (error) => error.name);

    await window.boot({ area: "local" });
    await window.offer();

    const { observation } = window.beacon.route("web").state.get();
    const outcome = await window.beacon.route("web").reload({ offer: observation.offer.ref });

    return { written, status: outcome.status, code: outcome.error && outcome.error.code, journal: window.beacon.transitions.get().journal, stillHere: location.href.endsWith("/") };
  })()`);

  expect(refused).toEqual({
    written: "QuotaExceededError",
    status: "failed",
    code: "JOURNAL_FAILED",
    journal: "degraded",
    stillHere: true,
  });
});

test("a sandboxed frame, where reading the storage property throws, rejects every call with the SecurityError as the cause", async ({
  page,
}) => {
  await page.goto(lab.url);

  const framed = await page.evaluate(`new Promise((resolve) => {
    const frame = document.createElement("iframe");

    frame.setAttribute("sandbox", "allow-scripts");
    frame.src = "/frame";
    addEventListener("message", (event) => resolve(JSON.parse(event.data)), { once: true });
    document.body.append(frame);
  })`);

  const refusal = {
    message:
      "The browser refuses web storage here, as a sandboxed frame or blocked site data does.",
    cause: "SecurityError",
  };

  expect(framed).toEqual({ read: refusal, write: refusal });
});

// Vite 8 compiles an `import.meta.env` name nobody defined to `void 0`, an empty define to an empty string, and a define of the text to the text.
const DEFINES = [
  { name: "a variable nobody set", env: undefined, known: null },
  { name: "an empty variable", env: "", known: null },
  { name: "the text undefined", env: "undefined", known: null },
  { name: "a real id", env: "a91b44e", known: "a91b44e" },
];

for (const { name, env, known } of DEFINES) {
  test(`a real Vite build with ${name} gives ${known === null ? "an unknown build" : "that build"}`, async ({
    page,
  }) => {
    const folder = mkdtempSync(path.join(tmpdir(), "beacon-vite-define-"));
    const original = process.env.VITE_BUILD_ID;

    try {
      writeFileSync(
        path.join(folder, "main.js"),
        `import { webBuild } from ${JSON.stringify(BROWSER)};\nwindow.__release = webBuild({ authority: "com.example.notes", id: import.meta.env.VITE_BUILD_ID })();\n`,
      );

      if (env === undefined) {
        Reflect.deleteProperty(process.env, "VITE_BUILD_ID");
      } else {
        process.env.VITE_BUILD_ID = env;
      }

      await build({
        root: folder,
        envDir: folder,
        logLevel: "silent",
        build: {
          outDir: path.join(folder, "out"),
          emptyOutDir: true,
          minify: false,
          lib: {
            entry: path.join(folder, "main.js"),
            name: "App",
            formats: ["iife"],
            fileName: () => "app.js",
          },
        },
      });

      await page.setContent(
        `<script>${readFileSync(path.join(folder, "out/app.js"), "utf8")}</script>`,
      );

      const release = await page.evaluate("window.__release");

      if (known === null) {
        expect(release).toEqual({
          identity: { status: "unknown", reason: "build-id-not-injected" },
          label: null,
          raw: {},
        });
      } else {
        expect(release).toMatchObject({
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "web-artifact",
            value: known,
          },
        });
      }
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(process.env, "VITE_BUILD_ID");
      } else {
        process.env.VITE_BUILD_ID = original;
      }

      rmSync(folder, { recursive: true, force: true });
    }
  });
}

// The recipe of `docs/browser.md` for a reload the page cancels is read from the page, so what the documentation shows is what runs here.
const readRecipe = () => {
  const page = readFileSync(BROWSER_DOCS, "utf8");
  const section = page.slice(page.indexOf("## A reload the page cancels"));
  const fence = /```ts\n([\s\S]*?)\n```/.exec(section);

  if (fence === null || fence[1] === undefined) {
    throw new Error("The page shows no recipe.");
  }

  return `(() => {${fence[1]}})()`;
};

// The same handler without the check that the page asked for a prompt.
const UNCONDITIONAL = `(() => { addEventListener("beforeunload", () => { setTimeout(() => beacon.route("web").acknowledge(), 0); }); })()`;

type Choice = "stay" | "leave";

// A page with an offer and a draft, whose prompt is answered as `choice` says; `dialogs` lists the prompts the browser showed.
const openWithDraft = async (
  page: Page,
  choice: Choice,
  recipe: string | null,
) => {
  const dialogs: string[] = [];

  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());

    if (choice === "stay") {
      await dialog.dismiss();

      return;
    }

    await dialog.accept();
  });

  await page.goto(lab.url);
  await page.evaluate("sessionStorage.clear(); localStorage.clear();");
  await page.evaluate("window.boot().then(() => window.offer())");

  if (recipe !== null) {
    await page.evaluate(recipe);
  }

  return dialogs;
};

// Real input gives the page the user activation a browser wants before it shows a prompt.
const typeADraft = async (page: Page) => {
  await page.locator("#draft").fill("my draft");
};

const requestReload = async (page: Page) => {
  await page.evaluate("setTimeout(() => window.goReload(), 0)");
  await page.waitForFunction("window.__outcome !== undefined");
};

const operation = (page: Page) =>
  page.evaluate("window.beacon.route('web').state.get().operation.state");

test("a reload the user cancels leaves the route unresolved and the draft locked, since nothing tells Beacon the page stayed", async ({
  page,
}) => {
  const dialogs = await openWithDraft(page, "stay", null);

  await typeADraft(page);
  await requestReload(page);

  expect(dialogs).toEqual(["beforeunload"]);
  await expect(page.locator("#draft")).not.toBeEditable();
  expect(await operation(page)).toBe("indeterminate");

  const again = await page.evaluate(`(async () => {
    const { observation } = window.beacon.route("web").state.get();
    const outcome = await window.beacon.route("web").reload({ offer: observation.offer.ref });

    return { status: outcome.status, codes: (outcome.reasons || []).map((reason) => reason.code) };
  })()`);

  expect(again).toEqual({
    status: "blocked",
    codes: ["operation-indeterminate"],
  });
});

for (const guard of ["preventDefault", "returnValue"]) {
  test(`with the recipe of the documentation, a prompt the page answered by staying gives the page back, for a guard written with ${guard}`, async ({
    page,
  }) => {
    const dialogs = await openWithDraft(page, "stay", readRecipe());

    // The guard of this page, written the way the test says.
    await page.evaluate(`window.draft.guard = ${JSON.stringify(guard)}`);

    await typeADraft(page);
    await requestReload(page);

    expect(dialogs).toEqual(["beforeunload"]);
    await expect(page.locator("#draft")).toBeEditable();
    expect(await operation(page)).toBe("idle");

    // Typing works, and a second reload is asked for and accepted, not blocked.
    await page.locator("#draft").fill("my draft, going on");
    await expect(page.locator("#draft")).toHaveValue("my draft, going on");

    const second = await page.evaluate(`(async () => {
      const { observation } = window.beacon.route("web").state.get();
      const outcome = await window.beacon.route("web").reload({ offer: observation.offer.ref });

      return outcome.status;
    })()`);

    expect(second).toBe("accepted");
  });
}

test("with the recipe, a prompt the user answers by leaving still reloads into the deploy, and the next boot judges it", async ({
  page,
}) => {
  state.delay = 600;

  const dialogs = await openWithDraft(page, "leave", readRecipe());

  await page.evaluate("fetch('/deploy').then((response) => response.text())");
  await typeADraft(page);

  const loaded = page.waitForEvent("load");

  await page.evaluate("setTimeout(() => window.goReload(), 0)");
  await loaded;

  expect(dialogs).toEqual(["beforeunload"]);

  // The timer ran while the new document was loading, so the old one had let go of the route by then.
  expect(await page.evaluate("document.cookie")).toBe(
    "operation-at-pagehide=idle",
  );

  const next = await page.evaluate("window.boot().then(() => window.judged())");

  expect(next).toEqual({
    journal: "ready",
    outcome: "target-running",
    running: "build-b",
  });
});

test("a reload nobody prompts about stays closed until the new document replaces the old one, with the recipe of the documentation", async ({
  page,
}) => {
  state.delay = 600;

  const dialogs = await openWithDraft(page, "stay", readRecipe());

  await page.evaluate("fetch('/deploy').then((response) => response.text())");

  const loaded = page.waitForEvent("load");

  await page.evaluate("setTimeout(() => window.goReload(), 0)");
  await loaded;

  expect(dialogs).toEqual([]);
  expect(await page.evaluate("document.cookie")).toBe(
    "operation-at-pagehide=indeterminate",
  );
});

test("a handler that acknowledges without asking whether a prompt was shown releases the route while the new document is still loading", async ({
  page,
}) => {
  state.delay = 600;

  const dialogs = await openWithDraft(page, "stay", UNCONDITIONAL);

  await page.evaluate("fetch('/deploy').then((response) => response.text())");

  const loaded = page.waitForEvent("load");

  await page.evaluate("setTimeout(() => window.goReload(), 0)");
  await loaded;

  expect(dialogs).toEqual([]);
  expect(await page.evaluate("document.cookie")).toBe(
    "operation-at-pagehide=idle",
  );
});

test("a service worker that precaches the page answers the reload from its cache, so the page runs the old build again and the journal says the target did not run", async ({
  page,
}) => {
  await page.goto(lab.url);
  await page.evaluate("sessionStorage.clear(); localStorage.clear();");
  await page.evaluate(
    "navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready)",
  );
  await page.waitForFunction("navigator.serviceWorker.controller !== null");
  await page.evaluate("window.boot().then(() => window.offer())");
  await page.evaluate("fetch('/deploy').then((response) => response.text())");

  const loaded = page.waitForEvent("load");

  await page.evaluate("setTimeout(() => window.goReload(), 0)");
  await loaded;

  const next = await page.evaluate("window.boot().then(() => window.judged())");

  expect(next).toEqual({
    journal: "ready",
    outcome: "target-not-running",
    running: "build-a",
  });
});
