import { expect, test, vi } from "vitest";

import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { createMockSource } from "src/mock/createMockSource";
import { createTestClock } from "src/mock/createTestClock";
import { settle } from "src/mock/settle";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RunningReaderContext } from "src/types/RunningReaderContext";
import {
  buildWebRelease,
  createBeacon,
  createRoutedBeacon,
  SCOPE,
} from "src/utils/Beacon.fixture";
import { Beacon } from "src/utils/Beacon";
import { createHeldMechanism } from "src/utils/commands.fixture";
import { createFakeDriver } from "src/utils/drivers.fixture";
import { createWebCommandBeacon } from "src/utils/commands.fixture";
import { createReloadMechanism } from "src/utils/routes.fixture";
import type { Manifest } from "src/utils/routes.fixture";
import { targetRoute } from "src/utils/targetRoute";

const createWebRoute = () => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const { mechanism } = createReloadMechanism();

  return targetRoute({
    source: mock.source.select((manifest) => manifest.web),
    mechanism,
  });
};

const createNativeRoute = () => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const { mechanism } = createHeldMechanism({ subject: "native" });

  return targetRoute({
    source: mock.source.select((manifest) => manifest.web),
    mechanism,
  });
};

test("a reader is given the scope the Beacon speaks for, and the next scope after a replacement", async () => {
  const contexts: RunningReaderContext[] = [];

  const { beacon } = createBeacon({
    running: {
      web: (context) => {
        contexts.push(context);

        return buildWebRelease("web-build-a");
      },
    },
  });

  beacon.start();
  await settle();

  expect(contexts).toEqual([{ scope: SCOPE }]);
  expect(Object.isFrozen(contexts[0]?.scope)).toBe(true);

  const staging: ReleaseScope = { ...SCOPE, environment: "staging" };

  expect(beacon.replaceScope(staging)).toEqual({ status: "replaced" });
  await settle();

  expect(contexts.map(({ scope }) => scope)).toEqual([SCOPE, staging]);
});

test("a reader that ignores the scope it is given still answers as before", async () => {
  const { beacon } = createBeacon({
    running: { web: () => buildWebRelease("web-build-a") },
  });

  beacon.start();
  await settle();

  expect(beacon.running.get().web.state).toBe("known");
});

test("the boot id is minted once for the realm and shared by every Beacon in it", () => {
  const first = createBeacon({ running: {} });
  const second = createBeacon({ running: {} });
  const { id } = first.beacon.running.get().boot;

  expect(id).toHaveLength(36);
  expect(id).not.toBe("boot-1");
  expect(second.beacon.running.get().boot.id).toBe(id);
});

test("a Beacon made without running readers at all has the boot of the realm", () => {
  const { beacon: shared } = createBeacon({ running: {} });

  const beacon = new Beacon({
    scope: SCOPE,
    routes: {},
    clock: createTestClock({ now: 1_000 }),
  });

  expect(beacon.running.get().boot).toEqual(shared.running.get().boot);
});

test("a boot id the application gives wins, and leaves the realm's for the others", () => {
  const given = createBeacon({ running: { boot: { id: "boot-given" } } });
  const left = createBeacon({ running: {} });

  expect(given.beacon.running.get().boot).toEqual({ id: "boot-given" });
  expect(left.beacon.running.get().boot.id).not.toBe("boot-given");
});

test("a second Beacon of the realm reads the intent of the first as the same boot, as Fast Refresh makes one", async () => {
  const memory = createMockJournalStorage();

  const first = createWebCommandBeacon({
    boot: null,
    journal: { mode: "required", storage: memory },
  });

  first.beacon.start();
  await first.beacon.route("web").refresh();

  const second = createWebCommandBeacon({
    boot: null,
    journal: { mode: "required", storage: memory },
  });

  second.beacon.start();
  await settle();

  expect(second.beacon.transitions.get().latest).toMatchObject({
    outcome: "same-boot",
  });
});

test("a feed route whose subject has no reader cannot be built, and the error names the route, the subject and what to pass", () => {
  const web = createWebRoute();

  expect(() => createRoutedBeacon({ web }, { running: {} })).toThrow(
    expect.objectContaining({
      code: "INVALID_CONFIGURATION",
      message:
        'Route "web" compares against the "web" subject, but running.web has no reader. Pass webBuild({ id }) or a reader of your own.',
    }),
  );
});

test("a feed route is not satisfied by a reader of another subject", () => {
  const web = createWebRoute();

  expect(() =>
    createRoutedBeacon(
      { web },
      { running: { native: () => buildWebRelease("native-1") } },
    ),
  ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
});

test("a feed route whose subject has a reader is built", () => {
  const web = createWebRoute();

  expect(() =>
    createRoutedBeacon(
      { web },
      { running: { web: () => buildWebRelease("web-build-a") } },
    ),
  ).not.toThrow();
});

test("a driver route needs no reader for its subject", () => {
  const { route } = createFakeDriver();

  const { beacon } = createRoutedBeacon({ ota: route }, { running: {} });

  expect(beacon.running.get().native).toEqual({ state: "unconfigured" });
});

test("a driver supplies the reader of its own subject when the application passes none, and it is given the scope", async () => {
  const contexts: RunningReaderContext[] = [];

  const { route } = createFakeDriver({
    running: (context) => {
      contexts.push(context);

      return buildWebRelease("native-default");
    },
  });

  const { beacon } = createRoutedBeacon({ ota: route }, { running: {} });

  expect(beacon.running.get().native).toEqual({ state: "pending" });
  beacon.start();
  await settle();

  const { native } = beacon.running.get();

  expect(native.state === "known" && native.release.identity).toMatchObject({
    value: "native-default",
  });
  expect(contexts).toEqual([{ scope: SCOPE }]);
});

test("a reader the application passes for the subject wins over the driver's, which is never asked", async () => {
  const fallback = vi.fn(() => buildWebRelease("native-default"));
  const { route } = createFakeDriver({ running: fallback });

  const { beacon } = createRoutedBeacon(
    { ota: route },
    { running: { native: () => buildWebRelease("native-explicit") } },
  );

  beacon.start();
  await settle();

  const { native } = beacon.running.get();

  expect(native.state === "known" && native.release.identity).toMatchObject({
    value: "native-explicit",
  });
  expect(fallback).not.toHaveBeenCalled();
});

test("a driver's reader of the subject a feed route compares against is the reader that route needs", async () => {
  const binary = createNativeRoute();
  const { route } = createFakeDriver({ running: () => buildWebRelease("n-1") });

  expect(() =>
    createRoutedBeacon({ binary, ota: route }, { running: {} }),
  ).not.toThrow();
});

test("two drivers that supply a reader for one subject cannot be built unless the application passes one", () => {
  const first = createFakeDriver({ running: () => buildWebRelease("one") });
  const second = createFakeDriver({ running: () => buildWebRelease("two") });

  expect(() =>
    createRoutedBeacon(
      { one: first.route, two: second.route },
      { running: {} },
    ),
  ).toThrow(
    expect.objectContaining({
      code: "INVALID_CONFIGURATION",
      message:
        'Routes "one" and "two" both supply a reader for the "native" subject. Pass running.native to choose one.',
    }),
  );

  expect(() =>
    createRoutedBeacon(
      { one: first.route, two: second.route },
      { running: { native: () => buildWebRelease("chosen") } },
    ),
  ).not.toThrow();
});
