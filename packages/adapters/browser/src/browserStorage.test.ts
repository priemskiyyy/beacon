import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import type {
  JournalOptions,
  NoneDecision,
  TargetDecision,
} from "@priemskiyyy/beacon";
import {
  createMockSource,
  createTestClock,
  settle,
} from "@priemskiyyy/beacon/mock";
import { expect, onTestFinished, test, vi } from "vitest";

import { browserReload } from "src/browserReload";
import { browserStorage } from "src/browserStorage";
import { fakeStorage, fakeStorageWindow } from "src/fakeStorage.fixture";
import { APPLICATION, fakeWindow, SCOPE } from "src/fakeWindow.fixture";
import type { BrowserStorageOptions } from "src/types/BrowserStorageOptions";
import { webBuild } from "src/webBuild";

const KEY = "beacon/v1/com.example.notes/production/web/public-web";

test("creating the storage touches the window not at all", () => {
  const { window, lookups } = fakeStorageWindow();

  browserStorage({ target: window });
  browserStorage({ area: "local", target: window });

  expect(lookups()).toBe(0);
});

test("the tab's own session storage is the default, and local storage is shared by every tab", async () => {
  const { window, session, local } = fakeStorageWindow();

  await browserStorage({ target: window }).write(KEY, "one");

  expect(session.items.get(KEY)).toBe("one");
  expect(local.items.size).toBe(0);

  await browserStorage({ area: "local", target: window }).write(KEY, "two");

  expect(local.items.get(KEY)).toBe("two");
  expect(session.items.get(KEY)).toBe("one");
});

test("a record is read, overwritten and removed under the journal's own key", async () => {
  const { window, session } = fakeStorageWindow();
  const storage = browserStorage({ target: window });

  await expect(storage.read(KEY)).resolves.toBeNull();

  await storage.write(KEY, "first");
  await storage.write(KEY, "second");

  expect([...session.items.keys()]).toEqual([KEY]);
  await expect(storage.read(KEY)).resolves.toBe("second");

  await storage.remove(KEY);

  await expect(storage.read(KEY)).resolves.toBeNull();
});

test("a write is read back, so a storage that keeps nothing fails it, unless verify is off", async () => {
  const session = fakeStorage({ keeps: false });
  const { window } = fakeStorageWindow({ session });

  await expect(
    browserStorage({ target: window }).write(KEY, "v"),
  ).rejects.toThrowError("did not keep");

  await expect(
    browserStorage({ target: window, verify: false }).write(KEY, "v"),
  ).resolves.toBeUndefined();
  expect(session.writes()).toBe(2);
});

test("a full storage rejects the write with the browser's own error, and the next write that fits lands", async () => {
  const session = fakeStorage({ capacity: KEY.length + 4 });
  const { window } = fakeStorageWindow({ session });
  const storage = browserStorage({ target: window });

  await expect(storage.write(KEY, "too long for it")).rejects.toMatchObject({
    name: "QuotaExceededError",
  });

  await storage.write(KEY, "fits");

  await expect(storage.read(KEY)).resolves.toBe("fits");
});

test("a window that blocks its storage, as a sandboxed frame does, rejects every call with the browser's error as the cause", async () => {
  const { window } = fakeStorageWindow({ blocked: new Set(["session"]) });
  const storage = browserStorage({ target: window });

  for (const call of [
    storage.read(KEY),
    storage.write(KEY, "v"),
    storage.remove(KEY),
  ]) {
    await expect(call).rejects.toMatchObject({
      message: expect.stringContaining("refuses web storage"),
      cause: expect.objectContaining({ name: "SecurityError" }),
    });
  }
});

test("only the area that is blocked fails, and the other still works", async () => {
  const { window } = fakeStorageWindow({ blocked: new Set(["local"]) });

  await expect(
    browserStorage({ target: window }).write(KEY, "v"),
  ).resolves.toBeUndefined();
  await expect(
    browserStorage({ area: "local", target: window }).read(KEY),
  ).rejects.toMatchObject({ cause: { name: "SecurityError" } });
});

test("the storage is reached at each call and never held, so a window that allows it later is used", async () => {
  const { window, blocked, session } = fakeStorageWindow({
    blocked: new Set(["session"]),
  });

  const storage = browserStorage({ target: window });

  await expect(storage.read(KEY)).rejects.toThrowError("refuses web storage");

  blocked.clear();
  session.items.set(KEY, "there");

  await expect(storage.read(KEY)).resolves.toBe("there");
});

test("without a window, as in a server render, every call rejects and nothing throws at once", async () => {
  const storage = browserStorage();

  for (const call of [
    () => storage.read(KEY),
    () => storage.write(KEY, "v"),
    () => storage.remove(KEY),
  ]) {
    let pending: Promise<unknown> | null = null;

    expect(() => {
      pending = call();
    }).not.toThrow();
    await expect(pending).rejects.toThrowError("no window");
  }
});

test("the global window is used when no target is given, and a target wins over it", async () => {
  const global = fakeStorageWindow();
  const own = fakeStorageWindow();

  vi.stubGlobal("window", global.window);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });

  await browserStorage().write(KEY, "global");
  await browserStorage({ target: own.window }).write(KEY, "own");

  expect(global.session.items.get(KEY)).toBe("global");
  expect(own.session.items.get(KEY)).toBe("own");
});

const createBoot = (
  {
    window,
    build,
    boot,
  }: {
    window: ReturnType<typeof fakeStorageWindow>["window"];
    build: string;
    boot: string;
  },
  options: {
    storage?: BrowserStorageOptions;
    journal?: JournalOptions["mode"];
  } = {},
) => {
  const mock = createMockSource<{ web: TargetDecision | NoneDecision }>({
    name: "manifest",
  });

  mock.answer({
    document: {
      web: {
        kind: "target",
        release: {
          identity: {
            status: "known",
            authority: APPLICATION,
            domain: "web-artifact",
            value: "build-b",
          },
          label: "Build b",
        },
      },
    },
    expiresAt: 601_000,
  });

  const page = fakeWindow();

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: boot },
      web: webBuild({ id: build }),
    },
    routes: {
      web: targetRoute({
        source: mock.source.select((manifest) => manifest.web),
        mechanism: browserReload({ target: page }),
      }),
    },
    journal: {
      mode: options.journal ?? "required",
      storage: browserStorage({ target: window, ...options.storage }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, page };
};

const reload = async ({ beacon }: ReturnType<typeof createBoot>) => {
  beacon.start();
  await beacon.check();

  const { observation } = beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  return beacon.route("web").reload({ offer: observation.offer.ref });
};

test("the intent a reload wrote is read back by the next boot of the same tab, which is what session storage is", async () => {
  const tab = fakeStorageWindow();

  const first = createBoot({
    window: tab.window,
    build: "build-a",
    boot: "boot-1",
  });

  await expect(reload(first)).resolves.toMatchObject({ status: "accepted" });
  expect(first.page.reloads()).toBe(1);
  expect([...tab.session.items.keys()]).toEqual([KEY]);

  // The reload replaced the document and kept the tab's session storage.
  const second = createBoot({
    window: tab.window,
    build: "build-b",
    boot: "boot-2",
  });

  second.beacon.start();
  await settle();

  expect(second.beacon.transitions.get()).toMatchObject({
    journal: "ready",
    latest: { outcome: "target-running" },
  });
});

test("a fresh tab has no session record of the reload, and with local storage it judges the intent of another tab", async () => {
  const sessionTab = fakeStorageWindow();
  const localTab = fakeStorageWindow();

  await reload(
    createBoot({ window: sessionTab.window, build: "build-a", boot: "boot-1" }),
  );
  await reload(
    createBoot(
      { window: localTab.window, build: "build-a", boot: "boot-1" },
      { storage: { area: "local" } },
    ),
  );

  const freshSession = createBoot({
    window: fakeStorageWindow().window,
    build: "build-b",
    boot: "boot-2",
  });

  freshSession.beacon.start();
  await settle();

  expect(freshSession.beacon.transitions.get().latest).toBeNull();

  const freshLocal = createBoot(
    {
      window: fakeStorageWindow({ local: localTab.local }).window,
      build: "build-b",
      boot: "boot-2",
    },
    { storage: { area: "local" } },
  );

  freshLocal.beacon.start();
  await settle();

  expect(freshLocal.beacon.transitions.get().latest).toMatchObject({
    outcome: "target-running",
  });
});

test("a full storage stops a required reload before the document is asked to go, and says the journal is degraded", async () => {
  const session = fakeStorage({ capacity: 10 });
  const tab = fakeStorageWindow({ session });

  const boot = createBoot({
    window: tab.window,
    build: "build-a",
    boot: "boot-1",
  });

  await expect(reload(boot)).resolves.toMatchObject({
    status: "failed",
    error: { code: "JOURNAL_FAILED" },
  });
  expect(boot.page.reloads()).toBe(0);
  expect(boot.beacon.transitions.get().journal).toBe("degraded");
});

test("a window that blocks storage leaves a best-effort reload going and the journal degraded", async () => {
  const tab = fakeStorageWindow({ blocked: new Set(["session"]) });

  const boot = createBoot(
    { window: tab.window, build: "build-a", boot: "boot-1" },
    { journal: "best-effort" },
  );

  await expect(reload(boot)).resolves.toMatchObject({ status: "accepted" });
  expect(boot.page.reloads()).toBe(1);
  expect(boot.beacon.transitions.get().journal).toBe("degraded");
});
