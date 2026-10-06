import { describe, expect, test } from "vitest";

import { SCOPE } from "src/fakeBackend.fixture";
import { fakeResponse, NOW, ROUTES } from "src/standardManifest.fixture";
import { readStandardManifest } from "src/utils/readStandardManifest";

const read = (response: ReturnType<typeof fakeResponse>) =>
  readStandardManifest({ response, scope: SCOPE, routes: ROUTES, now: NOW });

describe("a response with a document", () => {
  test("is a changed answer with the document, its evidence and its ETag as the validator", async () => {
    const answer = await read(fakeResponse({ etag: '"208"' }));

    expect(answer).toMatchObject({
      status: "changed",
      validator: '"208"',
      revision: { kind: "ordered", value: "208" },
      expiresAt: Date.parse("2026-09-27T10:10:00Z"),
    });

    expect(answer).toHaveProperty("document.routes.web.kind", "target");
  });

  test("without an ETag has no validator to send next time", async () => {
    await expect(read(fakeResponse())).resolves.not.toHaveProperty("validator");
  });

  test("the ETag is a validator and never the revision", async () => {
    const answer = await read(fakeResponse({ etag: '"7"' }));

    expect(answer).toMatchObject({ revision: { value: "208" } });
  });

  test.each([
    "application/json",
    "application/json; charset=utf-8",
    "APPLICATION/JSON",
    "application/vnd.beacon+json",
  ])("sent as %s is read", async (contentType) => {
    await expect(read(fakeResponse({ contentType }))).resolves.toMatchObject({
      status: "changed",
    });
  });
});

describe("a response that is not modified", () => {
  test("renews what the source holds and reads nothing", async () => {
    const response = fakeResponse({ status: 304, text: "" });

    await expect(read(response)).resolves.toEqual({ status: "not-modified" });
    expect(response.reads).toBe(0);
  });
});

describe("a response that is not the manifest is not a decision", () => {
  test("HTTP-08 a 200 that is not sent as JSON is refused, however it reads", async () => {
    for (const contentType of [
      "text/html",
      "text/html; charset=utf-8",
      "text/plain",
      null,
    ]) {
      const response = fakeResponse({ contentType });

      await expect(read(response)).rejects.toMatchObject({
        code: "INVALID_DOCUMENT",
        message: "The manifest is not a JSON response.",
      });

      expect(response.reads).toBe(0);
    }
  });

  test("HTTP-08 a login page sent as JSON is refused as not JSON", async () => {
    await expect(
      read(fakeResponse({ text: "<!doctype html><title>Sign in</title>" })),
    ).rejects.toMatchObject({
      code: "INVALID_DOCUMENT",
      message: "The manifest is not JSON.",
    });
  });

  test("HTTP-08 an empty 200 is refused, not taken for no release", async () => {
    await expect(read(fakeResponse({ text: "" }))).rejects.toMatchObject({
      code: "INVALID_DOCUMENT",
    });
  });
});

describe("every other status fails the read and says why", () => {
  const expectFailure = async (status: number, reason: string) => {
    const response = fakeResponse({ status });

    await expect(read(response)).rejects.toMatchObject({
      code: "SOURCE_FAILED",
      message: `The manifest endpoint ${reason}.`,
    });

    expect(response.reads).toBe(0);
  };

  test("HTTP-09 no content and not found are no release decision", async () => {
    await expectFailure(
      204,
      "answered with no content, which is not a release decision",
    );

    await expectFailure(
      404,
      "answered not found, which is not a release decision",
    );
  });

  test("HTTP-10 authentication and authorization failures keep their own reason", async () => {
    await expectFailure(401, "requires authentication");
    await expectFailure(403, "refused this client");
  });

  test("a limited rate fails the read, and nothing retries it here", async () => {
    await expectFailure(429, "is limiting the rate of this client");
  });

  test("a server error and a status nobody expects say their number", async () => {
    await expectFailure(500, "answered 500");
    await expectFailure(503, "answered 503");
    await expectFailure(302, "answered 302");
  });
});

describe("a redirected response is refused", () => {
  test("SEC-12 even when it carries a valid manifest", async () => {
    const response = fakeResponse({ redirected: true });

    await expect(read(response)).rejects.toMatchObject({
      code: "SOURCE_FAILED",
      message: "The manifest endpoint redirected, which this reader refuses.",
    });

    expect(response.reads).toBe(0);
  });

  test("SEC-12 not even a not modified one, which would renew a document another URL vouched for", async () => {
    const response = fakeResponse({ status: 304, redirected: true, text: "" });

    await expect(read(response)).rejects.toMatchObject({
      code: "SOURCE_FAILED",
      message: "The manifest endpoint redirected, which this reader refuses.",
    });
  });

  test("a redirect is named as one, not by the status it ended with", async () => {
    const response = fakeResponse({ status: 404, redirected: true });

    await expect(read(response)).rejects.toMatchObject({
      message: "The manifest endpoint redirected, which this reader refuses.",
    });
  });
});

describe("a response over the size limit is not read", () => {
  test("HTTP-12 when it declares a larger length", async () => {
    const response = fakeResponse({ contentLength: 262_145 });

    await expect(read(response)).rejects.toMatchObject({
      code: "INVALID_DOCUMENT",
      message: "The manifest is larger than 262144 bytes.",
    });

    expect(response.reads).toBe(0);
  });

  test("when it declares the limit, it is read", async () => {
    const response = fakeResponse({ contentLength: 262_144 });

    await expect(read(response)).resolves.toMatchObject({ status: "changed" });
  });

  test("the limit is the one the caller tunes", async () => {
    const response = fakeResponse({ contentLength: 1_001 });

    await expect(
      readStandardManifest({
        response,
        scope: SCOPE,
        routes: ROUTES,
        now: NOW,
        limits: { bytes: 1_000 },
      }),
    ).rejects.toThrow(/larger than 1000 bytes/);
  });

  test("when it declares no length, the text is checked as it is parsed", async () => {
    const response = fakeResponse({ text: "x".repeat(262_145) });

    await expect(read(response)).rejects.toThrow(/larger than 262144 bytes/);
    expect(response.reads).toBe(1);
  });
});

test("HTTP-18 a response of a runtime with no stream and no browser cache reads with only status, headers and text", async () => {
  const response = {
    status: 200,
    headers: { get: () => "application/json" },
    text: () => fakeResponse().text(),
  };

  await expect(
    readStandardManifest({ response, scope: SCOPE, routes: ROUTES, now: NOW }),
  ).resolves.toMatchObject({ status: "changed" });
});
