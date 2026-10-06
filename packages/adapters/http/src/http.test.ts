import { BeaconError } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { buildRead, fakeBackend, SCOPE } from "src/fakeBackend.fixture";
import { http } from "src/http";

test("creating the source asks the client for nothing", () => {
  const backend = fakeBackend();

  http({ request: backend.request });

  expect(backend.requests).toEqual([]);
});

test("the source is named for diagnostics, and http by default", () => {
  const backend = fakeBackend();

  expect(http({ request: backend.request }).name).toBe("http");
  expect(http({ name: "manifest", request: backend.request }).name).toBe(
    "manifest",
  );
});

test("the first read hands the client the scope, the signal, the attempt and no validator", async () => {
  const backend = fakeBackend();
  const controller = new AbortController();

  await http({ request: backend.request }).read({
    scope: SCOPE,
    signal: controller.signal,
    attempt: 3,
  });

  expect(backend.requests).toEqual([
    { scope: SCOPE, signal: controller.signal, attempt: 3, validator: null },
  ]);
});

test("a changed answer is the read: the document and its evidence, without the client's envelope", async () => {
  const backend = fakeBackend();
  const answer = await http({ request: backend.request }).read(buildRead());

  expect(answer).toEqual({
    document: {
      web: {
        kind: "target",
        release: {
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "web-artifact",
            value: "web-build-a",
          },
          label: "Build web-build-a",
        },
      },
    },
    revision: { kind: "ordered", domain: "web", epoch: "v1", value: "208" },
    digest: "web-build-a",
    issuer: "release-service",
    expiresAt: 601_000,
  });
});

test("a changed answer that proves nothing about itself is a bare document", async () => {
  const source = http({
    request: () => ({
      status: "changed",
      document: { web: "web-build-a" },
    }),
  });

  await expect(source.read(buildRead())).resolves.toEqual({
    document: { web: "web-build-a" },
  });
});

test("the next read sends the validator the last accepted answer gave", async () => {
  const backend = fakeBackend();
  const source = http({ request: backend.request });

  await source.read(buildRead());
  await source.read(buildRead());

  expect(backend.requests.map((request) => request.validator)).toEqual([
    null,
    '"208"',
  ]);
});

test("HTTP-06 not modified renews the document the source holds, with the new expiry", async () => {
  const backend = fakeBackend();
  const source = http({ request: backend.request });
  const first = await source.read(buildRead());

  backend.state.expiresAt = 1_201_000;

  const renewed = await source.read(buildRead());

  expect(renewed).toEqual({ ...first, expiresAt: 1_201_000 });
  expect(renewed.document).toBe(first.document);
});

test("not modified without an expiry keeps the old one, so freshness is never assumed", async () => {
  let calls = 0;

  const source = http({
    request: () => {
      calls += 1;

      if (calls === 1) {
        return {
          status: "changed",
          document: "manifest",
          validator: '"1"',
          expiresAt: 601_000,
        };
      }

      return { status: "not-modified" };
    },
  });

  await source.read(buildRead());

  await expect(source.read(buildRead())).resolves.toEqual({
    document: "manifest",
    expiresAt: 601_000,
  });
});

test("a new document replaces the held one and its validator", async () => {
  const backend = fakeBackend();
  const source = http({ request: backend.request });

  await source.read(buildRead());
  backend.publish("web-build-b", '"209"');
  await source.read(buildRead());
  await source.read(buildRead());

  expect(backend.requests.map((request) => request.validator)).toEqual([
    null,
    '"208"',
    '"209"',
  ]);
});

test("HTTP-07 not modified with no document to renew fails the read, never as no offer", async () => {
  const source = http({ request: () => ({ status: "not-modified" }) });

  await expect(source.read(buildRead())).rejects.toMatchObject({
    code: "SOURCE_FAILED",
  });
});

test("another scope never inherits the validator or the document of the first", async () => {
  const backend = fakeBackend();
  const source = http({ request: backend.request });

  await source.read(buildRead());
  await source.read({ ...buildRead(), scope: { ...SCOPE } });

  expect(backend.requests.map((request) => request.validator)).toEqual([
    null,
    null,
  ]);
});

test("a failed request keeps what the source holds, so the next read is still conditional", async () => {
  const backend = fakeBackend();
  let broken = false;

  const source = http({
    request: (request) => {
      if (broken) {
        throw new Error("offline");
      }

      return backend.request(request);
    },
  });

  await source.read(buildRead());
  broken = true;

  await expect(source.read(buildRead())).rejects.toThrow("offline");

  broken = false;
  await source.read(buildRead());

  expect(backend.requests.map((request) => request.validator)).toEqual([
    null,
    '"208"',
  ]);
});

test("an error the client throws reaches the read as it was thrown, and a BeaconError keeps its code", async () => {
  const failure = new BeaconError({
    code: "SOURCE_FAILED",
    message: "The manifest failed validation.",
  });

  const source = http({
    request: () => {
      throw failure;
    },
  });

  await expect(source.read(buildRead())).rejects.toBe(failure);
});

test("selecting a view reads nothing and belongs to the source", () => {
  const backend = fakeBackend();
  const source = http({ request: backend.request });
  const projection = source.select((manifest) => manifest.web);

  expect(projection.source).toBe(source);
  expect(backend.requests).toEqual([]);
});

test("HTTP-02 the same scope for another partition is neither sent the validator nor renewed by it", async () => {
  const backend = fakeBackend();
  let account = "alice";

  const source = http({
    partition: () => account,
    request: backend.request,
  });

  await source.read(buildRead());
  await source.read(buildRead());

  account = "bob";
  await source.read(buildRead());

  expect(backend.requests.map((request) => request.validator)).toEqual([
    null,
    '"208"',
    null,
  ]);
});

test("HTTP-02 a not modified answer for another partition renews nothing of the first", async () => {
  const backend = fakeBackend();
  let account = "alice";
  let notModified = false;

  const source = http({
    partition: () => account,
    request: (request) => {
      if (notModified) {
        return { status: "not-modified" };
      }

      return backend.request(request);
    },
  });

  await source.read(buildRead());

  account = "bob";
  notModified = true;

  await expect(source.read(buildRead())).rejects.toMatchObject({
    code: "SOURCE_FAILED",
  });
});

test("a partition that returns to the first one finds nothing to renew either, since the source keeps one answer", async () => {
  const backend = fakeBackend();
  let account = "alice";

  const source = http({
    partition: () => account,
    request: backend.request,
  });

  await source.read(buildRead());

  account = "bob";
  await source.read(buildRead());

  account = "alice";
  await source.read(buildRead());

  expect(backend.requests.map((request) => request.validator)).toEqual([
    null,
    null,
    null,
  ]);
});

test("without a partition every read speaks for the same one", async () => {
  const backend = fakeBackend();
  const source = http({ request: backend.request });

  await source.read(buildRead());
  await source.read(buildRead());

  expect(backend.requests.map((request) => request.validator)).toEqual([
    null,
    '"208"',
  ]);
});
