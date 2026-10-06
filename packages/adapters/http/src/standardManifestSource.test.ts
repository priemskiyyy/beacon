import { createTestClock } from "@priemskiyyy/beacon/mock";
import { afterEach, describe, expect, test, vi } from "vitest";

import { buildRead, SCOPE } from "src/fakeBackend.fixture";
import {
  buildManifest,
  fakeResponse,
  NOW,
  ROUTES,
} from "src/standardManifest.fixture";
import { standardManifestSource } from "src/standardManifestSource";
import type { ManifestFetch } from "src/types/ManifestFetch";

const DAY = 86_400_000;

// What a static host serves for both routes: the decisions and nothing else.
const STATIC = JSON.stringify({
  schemaVersion: 1,
  routes: {
    web: { kind: "target", release: { identity: "a91b44e" } },
    binary: { kind: "none", reason: "up-to-date" },
  },
});

type Request = { url: string; init: Parameters<ManifestFetch>[1] };

// A server that answers with `respond` and remembers how it was asked.
const fakeServer = (respond: () => ReturnType<typeof fakeResponse>) => {
  const requests: Request[] = [];

  const fetch: ManifestFetch = async (url, init) => {
    requests.push({ url, init });

    return respond();
  };

  return { fetch, requests };
};

const read = (clock = createTestClock({ now: NOW })) => ({
  ...buildRead(),
  clock,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("creating the source asks for nothing, and it is named for diagnostics", () => {
  const server = fakeServer(() => fakeResponse());

  const source = standardManifestSource({
    url: "/releases.json",
    routes: ROUTES,
    fetch: server.fetch,
  });

  expect(server.requests).toEqual([]);
  expect(source.name).toBe("manifest");
  expect(
    standardManifestSource({
      name: "releases",
      url: "/releases.json",
      routes: ROUTES,
      fetch: server.fetch,
    }).name,
  ).toBe("releases");
});

test("a read asks for the url with the caller's signal, headers and a cache that revalidates, and no validator yet", async () => {
  const server = fakeServer(() => fakeResponse({ text: STATIC }));
  const controller = new AbortController();

  const source = standardManifestSource({
    url: "https://updates.example.com/releases.json",
    routes: ROUTES,
    headers: { authorization: "Bearer token" },
    fetch: server.fetch,
  });

  await source.read({ ...read(), signal: controller.signal });

  expect(server.requests).toEqual([
    {
      url: "https://updates.example.com/releases.json",
      init: {
        signal: controller.signal,
        cache: "no-cache",
        headers: { authorization: "Bearer token" },
      },
    },
  ]);
});

test("the manifest of a static host is a typed document whose evidence says what it does not know", async () => {
  const server = fakeServer(() => fakeResponse({ text: STATIC }));
  const clock = createTestClock({ now: NOW });

  const source = standardManifestSource({
    url: "/releases.json",
    routes: ROUTES,
    fetch: server.fetch,
  });

  const answer = await source.read(read(clock));

  expect(answer.document.routes.web).toEqual({
    kind: "target",
    release: {
      identity: {
        status: "known",
        authority: SCOPE.application,
        domain: "web-artifact",
        value: "a91b44e",
      },
    },
  });

  // No revision and no expiry of the authority's: the window is the client's, counted on the Beacon's clock.
  expect(answer.revision).toBeUndefined();
  expect(answer.expiresAt).toBe(NOW + DAY);
  expect(answer.digest).toMatch(/^[0-9a-f]{16}$/);
});

test("the time is the Beacon's, read after the response arrived", async () => {
  const clock = createTestClock({ now: NOW });

  const server = fakeServer(() => {
    clock.advance(1_000);

    return fakeResponse({ text: STATIC });
  });

  const source = standardManifestSource({
    url: "/releases.json",
    routes: ROUTES,
    fetch: server.fetch,
  });

  await expect(source.read(read(clock))).resolves.toMatchObject({
    expiresAt: NOW + 1_000 + DAY,
  });
});

test("a manifest with the times and the revision of a host that can write them is read as it says", async () => {
  const server = fakeServer(() => fakeResponse());

  const source = standardManifestSource({
    url: "/releases.json",
    routes: ROUTES,
    fetch: server.fetch,
  });

  await expect(source.read(read())).resolves.toMatchObject({
    revision: { kind: "ordered", value: "208" },
    expiresAt: Date.parse("2026-09-27T10:10:00Z"),
  });
});

describe("the validator", () => {
  test("the etag of one answer is sent back as if-none-match, and a not modified renews the document held", async () => {
    const clock = createTestClock({ now: NOW });

    const answers = [
      fakeResponse({ text: STATIC, etag: '"a91b44e"' }),
      fakeResponse({ status: 304 }),
    ];

    const server = fakeServer(() => answers.shift() ?? fakeResponse());

    const source = standardManifestSource({
      url: "/releases.json",
      routes: ROUTES,
      headers: { authorization: "Bearer token" },
      fetch: server.fetch,
    });

    const first = await source.read(read(clock));

    clock.advance(2 * DAY);

    const renewed = await source.read(read(clock));

    expect(server.requests.map(({ init }) => init.headers)).toEqual([
      { authorization: "Bearer token" },
      { authorization: "Bearer token", "if-none-match": '"a91b44e"' },
    ]);

    // The backend claimed no expiry, so its confirmation starts the window again.
    expect(renewed.document).toBe(first.document);
    expect(renewed.expiresAt).toBe(NOW + 2 * DAY + DAY);
  });

  test("a not modified answer keeps the expiry a manifest claimed for itself, so it is never fresher than the authority said", async () => {
    const clock = createTestClock({ now: NOW });

    const answers = [
      fakeResponse({ etag: '"208"' }),
      fakeResponse({ status: 304 }),
    ];

    const server = fakeServer(() => answers.shift() ?? fakeResponse());

    const source = standardManifestSource({
      url: "/releases.json",
      routes: ROUTES,
      fetch: server.fetch,
    });

    await source.read(read(clock));
    clock.advance(1_000);

    await expect(source.read(read(clock))).resolves.toMatchObject({
      expiresAt: Date.parse("2026-09-27T10:10:00Z"),
    });
  });
});

describe("what is refused, and never taken for a decision of no release", () => {
  const readWith = (respond: () => ReturnType<typeof fakeResponse>) =>
    standardManifestSource({
      url: "/releases.json",
      routes: ROUTES,
      fetch: fakeServer(respond).fetch,
    }).read(read());

  test("a redirected response", async () => {
    await expect(
      readWith(() => fakeResponse({ redirected: true })),
    ).rejects.toMatchObject({ code: "SOURCE_FAILED" });
  });

  test.each([204, 401, 403, 404, 429, 500])("the status %i", async (status) => {
    await expect(
      readWith(() => fakeResponse({ status })),
    ).rejects.toMatchObject({ code: "SOURCE_FAILED" });
  });

  test("a body that is not a manifest, such as a login page", async () => {
    await expect(
      readWith(() =>
        fakeResponse({ contentType: "text/html", text: "<html></html>" }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_DOCUMENT" });
  });

  test("a manifest that echoes another scope", async () => {
    const text = JSON.stringify({ ...buildManifest(), environment: "staging" });

    await expect(readWith(() => fakeResponse({ text }))).rejects.toMatchObject({
      code: "INVALID_DOCUMENT",
      message: "The manifest environment is not the scope's.",
    });
  });

  test("a request that fails, whatever it throws", async () => {
    const source = standardManifestSource({
      url: "/releases.json",
      routes: ROUTES,
      fetch: () => Promise.reject(new Error("offline")),
    });

    await expect(source.read(read())).rejects.toThrow("offline");
  });
});

test("the limits of a manifest are the application's to tune", async () => {
  const server = fakeServer(() => fakeResponse({ text: STATIC }));

  const source = standardManifestSource({
    url: "/releases.json",
    routes: ROUTES,
    limits: { bytes: STATIC.length - 1, lifetime: 600_000 },
    fetch: server.fetch,
  });

  await expect(source.read(read())).rejects.toMatchObject({
    code: "INVALID_DOCUMENT",
    message: `The manifest is larger than ${STATIC.length - 1} bytes.`,
  });

  const within = standardManifestSource({
    url: "/releases.json",
    routes: ROUTES,
    limits: { lifetime: 600_000 },
    fetch: server.fetch,
  });

  await expect(within.read(read())).resolves.toMatchObject({
    expiresAt: NOW + 600_000,
  });
});

describe("without a client of its own it uses the global fetch", () => {
  test("called as a plain function, with the url and the same options", async () => {
    const calls: Array<{ self: unknown; url: unknown; init: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      function (this: unknown, url: unknown, init: unknown) {
        calls.push({ self: this, url, init });

        return Promise.resolve(fakeResponse({ text: STATIC }));
      },
    );

    const controller = new AbortController();

    const source = standardManifestSource({
      url: "/releases.json",
      routes: ROUTES,
    });

    await source.read({ ...read(), signal: controller.signal });

    expect(calls).toEqual([
      {
        self: undefined,
        url: "/releases.json",
        init: { signal: controller.signal, cache: "no-cache", headers: {} },
      },
    ]);
  });

  test("and a host without one fails the read, naming the option that fixes it", async () => {
    vi.stubGlobal("fetch", undefined);

    const source = standardManifestSource({
      url: "/releases.json",
      routes: ROUTES,
    });

    await expect(source.read(read())).rejects.toMatchObject({
      code: "SOURCE_FAILED",
      message: expect.stringContaining("pass one as the fetch option"),
    });
  });
});
