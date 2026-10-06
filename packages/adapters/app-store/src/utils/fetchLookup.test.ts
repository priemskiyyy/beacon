import { afterEach, expect, test, vi } from "vitest";

import { APP_ID, entry } from "src/fakeStore.fixture";
import { fetchLookup } from "src/utils/fetchLookup";

const URL_OF_LOOKUP = `https://itunes.apple.com/lookup?id=${APP_ID}&country=de`;

type Answer = {
  status?: number;
  redirected?: boolean;
  body?: unknown;
  failure?: Error;
};

// A global `fetch` that answers as scripted and records what it was asked.
const stubFetch = ({
  status = 200,
  redirected = false,
  body = { resultCount: 1, results: [entry()] },
  failure,
}: Answer = {}) => {
  const asked: Array<{ url: string; signal: AbortSignal | null | undefined }> =
    [];

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    asked.push({ url, signal: init?.signal });

    if (failure !== undefined) {
      throw failure;
    }

    return {
      ok: status >= 200 && status < 300,
      status,
      redirected,
      json: async () => body,
    };
  });

  return asked;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const lookUp = () =>
  fetchLookup({ url: URL_OF_LOOKUP, signal: new AbortController().signal });

test("the lookup is fetched from the URL with the signal of the read, and its entries are what the source reads", async () => {
  const asked = stubFetch();
  const controller = new AbortController();

  await expect(
    fetchLookup({ url: URL_OF_LOOKUP, signal: controller.signal }),
  ).resolves.toEqual({ results: [entry()] });
  expect(asked).toEqual([{ url: URL_OF_LOOKUP, signal: controller.signal }]);
});

test("the fields the lookup has beyond the four the adapter reads are dropped, and none is repaired", async () => {
  stubFetch({
    body: {
      resultCount: 1,
      results: [{ ...entry(), artistName: "Example", price: 0 }],
    },
  });

  await expect(lookUp()).resolves.toEqual({ results: [entry()] });
});

test("a lookup that matched nothing is an empty list, which the source reads as no match", async () => {
  stubFetch({ body: { resultCount: 0, results: [] } });

  await expect(lookUp()).resolves.toEqual({ results: [] });
});

test("a status that is not a success fails the read and names the status, for a rate limit and a server error alike", async () => {
  for (const status of [403, 429, 500, 503]) {
    stubFetch({ status });

    await expect(lookUp()).rejects.toMatchObject({
      code: "SOURCE_FAILED",
      message: `The App Store lookup answered ${status}.`,
    });
  }
});

test("a response that says it was redirected is refused, where the response can say so", async () => {
  stubFetch({ redirected: true });

  await expect(lookUp()).rejects.toMatchObject({ code: "SOURCE_FAILED" });
});

test("a fetch that rejects, such as a network failure, is the failure of the read as it was thrown", async () => {
  const failure = new TypeError("Network request failed");

  stubFetch({ failure });

  await expect(lookUp()).rejects.toBe(failure);
});

test("a body that is not JSON is the parser's own failure, never an empty answer", async () => {
  vi.stubGlobal("fetch", async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON");
    },
  }));

  await expect(lookUp()).rejects.toBeInstanceOf(SyntaxError);
});

test("a body that is JSON and not a lookup is an invalid document, whatever it is", async () => {
  for (const body of [
    null,
    "ok",
    42,
    [],
    {},
    { results: null },
    { results: {} },
    { errorMessage: "Invalid value(s) for key(s): [country]" },
  ]) {
    stubFetch({ body });

    await expect(lookUp()).rejects.toMatchObject({
      code: "INVALID_DOCUMENT",
    });
  }
});

test("an entry without what the source needs to know is an invalid document, and so is one of another type", async () => {
  const { trackId, bundleId, version, currentVersionReleaseDate } = entry();

  for (const broken of [
    null,
    "entry",
    { bundleId, version, currentVersionReleaseDate },
    { trackId: String(trackId), bundleId, version, currentVersionReleaseDate },
    { trackId, version, currentVersionReleaseDate },
    { trackId, bundleId, currentVersionReleaseDate },
    { trackId, bundleId, version },
    { trackId, bundleId, version: 3, currentVersionReleaseDate },
  ]) {
    stubFetch({ body: { resultCount: 1, results: [broken] } });

    await expect(lookUp()).rejects.toMatchObject({
      code: "INVALID_DOCUMENT",
    });
  }
});
