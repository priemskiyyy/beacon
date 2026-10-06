import { expect, test } from "vitest";

import { appStoreLookup } from "src/appStoreLookup";
import { APP_ID, BUNDLE_ID, entry, fakeStore } from "src/fakeStore.fixture";

const buildRead = () => ({
  scope: {
    application: BUNDLE_ID,
    environment: "production",
    platform: "ios",
    distribution: "app-store",
  },
  signal: new AbortController().signal,
  attempt: 1,
});

test("creating the source makes no request", () => {
  const store = fakeStore();

  appStoreLookup({ appId: APP_ID, country: "de", fetch: store.fetch });

  expect(store.fetches).toEqual([]);
});

test("a read asks for the configured app in the configured storefront", async () => {
  const store = fakeStore();
  const read = buildRead();

  await appStoreLookup({
    appId: APP_ID,
    country: "de",
    fetch: store.fetch,
  }).read(read);

  expect(store.fetches).toEqual([
    {
      url: `https://itunes.apple.com/lookup?id=${APP_ID}&country=de`,
      signal: read.signal,
    },
  ]);
});

test("the answer is the decision, from the store as its issuer", async () => {
  const store = fakeStore([entry({ version: "3.4.0" })]);

  const answer = await appStoreLookup({
    appId: APP_ID,
    country: "de",
    bundleId: BUNDLE_ID,
    fetch: store.fetch,
  }).read(buildRead());

  expect(answer).toMatchObject({
    document: { decision: { kind: "candidate", release: { order: "3.4.0" } } },
    issuer: "app-store",
  });
});

test("a client that throws fails the read as it was thrown", async () => {
  const store = fakeStore();
  const failure = new Error("rate limited");

  store.fail(failure);

  await expect(
    appStoreLookup({
      appId: APP_ID,
      country: "de",
      fetch: store.fetch,
    }).read(buildRead()),
  ).rejects.toBe(failure);
});

test("STORE-03 an id that is not a number, or a storefront that is not a country, is refused at construction", () => {
  const store = fakeStore();

  expect(() =>
    appStoreLookup({ appId: "12a", country: "de", fetch: store.fetch }),
  ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  expect(() =>
    appStoreLookup({ appId: APP_ID, country: "DE", fetch: store.fetch }),
  ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  expect(() =>
    appStoreLookup({
      appId: APP_ID,
      country: "de&id=1",
      fetch: store.fetch,
    }),
  ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
});

test("the source is named for diagnostics, and app-store-lookup by default", () => {
  const store = fakeStore();

  expect(
    appStoreLookup({ appId: APP_ID, country: "de", fetch: store.fetch }).name,
  ).toBe("app-store-lookup");
  expect(
    appStoreLookup({
      appId: APP_ID,
      country: "de",
      name: "ios-store",
      fetch: store.fetch,
    }).name,
  ).toBe("ios-store");
});

test("STORE-09 a scope of another distribution is answered without a request, and never as an offer", async () => {
  const store = fakeStore([entry({ version: "3.4.0" })]);

  const source = appStoreLookup({
    appId: APP_ID,
    country: "de",
    bundleId: BUNDLE_ID,
    fetch: store.fetch,
  });

  for (const distribution of ["testflight", "enterprise", "development"]) {
    const read = buildRead();

    await expect(
      source.read({ ...read, scope: { ...read.scope, distribution } }),
    ).resolves.toEqual({
      document: { decision: { kind: "none", reason: "other-distribution" } },
    });
  }

  expect(store.fetches).toEqual([]);
});
