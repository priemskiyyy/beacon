import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import { createUpdateMechanism } from "@priemskiyyy/beacon/adapter";
import type { RunningRelease } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { expect, test } from "vitest";

import { SCOPE } from "src/fakeBackend.fixture";
import { STATIC_MANIFEST } from "src/fakeStaticServer.fixture";
import { fakeResponse } from "src/standardManifest.fixture";
import { standardManifestSource } from "src/standardManifestSource";
import type { ManifestFetch } from "src/types/ManifestFetch";

const DAY = 86_400_000;

const inert = createUpdateMechanism({
  name: "inert",
  subject: "web",
  open: () => ({ native: {} }),
  commands: {},
});

const running = (value: string): RunningRelease => ({
  identity: {
    status: "known",
    authority: SCOPE.application,
    domain: "web-artifact",
    value,
  },
  label: value,
  raw: {},
});

const manifestOf = (build: string) =>
  JSON.stringify({
    schemaVersion: 1,
    routes: { web: { kind: "target", release: { identity: build } } },
  });

// A static host: the file that is deployed now, and the ETag of it. A request that sends the current ETag gets a 304.
const create = (initial = "a91b44e") => {
  const clock = createTestClock({ now: Date.parse("2026-09-27T10:00:00Z") });
  const server = { build: initial, requests: 0 };

  const fetch: ManifestFetch = async (_url, init) => {
    server.requests += 1;

    const etag = `"${server.build}"`;

    if (init.headers["if-none-match"] === etag) {
      return fakeResponse({ status: 304 });
    }

    return fakeResponse({ text: manifestOf(server.build), etag });
  };

  const manifest = standardManifestSource({
    url: "/releases.json",
    routes: { web: { kind: "target" } },
    fetch,
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" }, web: () => running("build-a") },
    routes: {
      web: targetRoute({
        source: manifest.select((document) => document.routes.web),
        mechanism: inert,
      }),
    },
    clock,
  });

  return { beacon, clock, server };
};

test("a bare file of a static host is an offer of the build it names, which nothing running has", async () => {
  const { beacon } = create();

  beacon.start();
  await beacon.check();

  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
    offer: {
      release: {
        identity: {
          status: "known",
          authority: "com.example.notes",
          domain: "web-artifact",
          value: "a91b44e",
        },
      },
    },
    evidence: { revision: null, freshness: "fresh" },
  });
});

test("the evidence of such a file is the client's window, which goes stale by time alone, and the server's confirmation starts it again", async () => {
  const { beacon, clock, server } = create();

  beacon.start();
  await beacon.check();

  const first = beacon.route("web").state.get().observation;

  if (first.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  expect(first.evidence.expiresAt).toBe(clock.now() + DAY);

  clock.advance(DAY + 1);

  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
    evidence: { freshness: "expired" },
  });

  // The server says the file is what it was: a 304, which this source counts as a read that confirms it today.
  await beacon.check();

  expect(server.requests).toBe(2);
  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
    evidence: { freshness: "fresh", expiresAt: clock.now() + DAY },
  });
});

test("a new deploy is a new offer, and a build that runs is no offer", async () => {
  const { beacon, server } = create();

  beacon.start();
  await beacon.check();

  server.build = "build-a";
  await beacon.check();

  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "none",
  });

  server.build = "a91b44e";
  await beacon.check();

  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { identity: { value: "a91b44e" } } },
  });
});

test("a file with no revision cannot tell an older copy from a newer one, so only the window and the server bound it", async () => {
  const { beacon, server } = create("a91b44e");

  beacon.start();
  await beacon.check();

  // A cache that serves an older deploy after a newer one is believed: there is no revision to regress.
  server.build = "build-a";
  await expect(beacon.check()).resolves.toMatchObject({
    routes: { web: { status: "succeeded" } },
  });
});

test("a file that is not the manifest fails the check and keeps what was accepted", async () => {
  const clock = createTestClock({ now: Date.parse("2026-09-27T10:00:00Z") });
  let body = STATIC_MANIFEST;

  const manifest = standardManifestSource({
    url: "/releases.json",
    routes: { web: { kind: "target" } },
    fetch: async () => fakeResponse({ text: body }),
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" }, web: () => running("build-a") },
    routes: {
      web: targetRoute({
        source: manifest.select((document) => document.routes.web),
        mechanism: inert,
      }),
    },
    clock,
  });

  beacon.start();
  await beacon.check();

  body = "<html>Sign in</html>";

  await expect(beacon.check()).resolves.toMatchObject({
    routes: { web: { status: "failed", error: { code: "INVALID_DOCUMENT" } } },
  });
  expect(beacon.route("web").state.get()).toMatchObject({
    check: { state: "failed" },
    observation: {
      status: "available",
      offer: { release: { identity: { value: "a91b44e" } } },
    },
  });
});
