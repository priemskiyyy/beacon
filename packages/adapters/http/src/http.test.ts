import { BeaconError } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { buildRead, fakeBackend, SCOPE } from "src/fakeBackend.fixture";
import { http } from "src/http";

test("creating the source asks the client for nothing", () => {
  const backend = fakeBackend();

  http({ fetch: backend.fetch });

  expect(backend.fetches).toEqual([]);
});

test("the source is named for diagnostics, and http by default", () => {
  const backend = fakeBackend();

  expect(http({ fetch: backend.fetch }).name).toBe("http");
  expect(http({ name: "manifest", fetch: backend.fetch }).name).toBe(
    "manifest",
  );
});

test("the first read hands the client the scope, the signal, the attempt and no validator", async () => {
  const backend = fakeBackend();
  const controller = new AbortController();

  await http({ fetch: backend.fetch }).read({
    scope: SCOPE,
    signal: controller.signal,
    attempt: 3,
  });

  expect(backend.fetches).toEqual([
    { scope: SCOPE, signal: controller.signal, attempt: 3, validator: null },
  ]);
});

test("a changed answer is the read: the document and its evidence, without the client's envelope", async () => {
  const backend = fakeBackend();
  const answer = await http({ fetch: backend.fetch }).read(buildRead());

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
    fetch: () => ({
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
  const source = http({ fetch: backend.fetch });

  await source.read(buildRead());
  await source.read(buildRead());

  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    '"208"',
  ]);
});

test("HTTP-06 not modified renews the document the source holds, with the new expiry", async () => {
  const backend = fakeBackend();
  const source = http({ fetch: backend.fetch });
  const first = await source.read(buildRead());

  backend.state.expiresAt = 1_201_000;

  const renewed = await source.read(buildRead());

  expect(renewed).toEqual({ ...first, expiresAt: 1_201_000 });
  expect(renewed.document).toBe(first.document);
});

test("not modified without an expiry keeps the old one, so freshness is never assumed", async () => {
  let calls = 0;

  const source = http({
    fetch: () => {
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
  const source = http({ fetch: backend.fetch });

  await source.read(buildRead());
  backend.publish("web-build-b", '"209"');
  await source.read(buildRead());
  await source.read(buildRead());

  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    '"208"',
    '"209"',
  ]);
});

test("HTTP-07 not modified with no document to renew fails the read, never as no offer", async () => {
  const source = http({ fetch: () => ({ status: "not-modified" }) });

  await expect(source.read(buildRead())).rejects.toMatchObject({
    code: "SOURCE_FAILED",
  });
});

test("an answer that is neither changed nor not modified renews nothing, even with a document held", async () => {
  const backend = fakeBackend();
  let garbled = false;

  // The types forbid this answer, and a client written in JavaScript can still give it.
  const garbage = JSON.parse('{"status":"unchanged"}');

  const source = http({
    fetch: (context) => {
      if (garbled) {
        return garbage;
      }

      return backend.fetch(context);
    },
  });

  await source.read(buildRead());
  garbled = true;

  await expect(source.read(buildRead())).rejects.toMatchObject({
    code: "SOURCE_FAILED",
    message: "The client answered neither changed nor not modified.",
  });
});

test("another scope never inherits the validator or the document of the first", async () => {
  const backend = fakeBackend();
  const source = http({ fetch: backend.fetch });

  await source.read(buildRead());
  await source.read({ ...buildRead(), scope: { ...SCOPE } });

  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    null,
  ]);
});

test("a client that fails keeps what the source holds, so the next read is still conditional", async () => {
  const backend = fakeBackend();
  let broken = false;

  const source = http({
    fetch: (context) => {
      if (broken) {
        throw new Error("offline");
      }

      return backend.fetch(context);
    },
  });

  await source.read(buildRead());
  broken = true;

  await expect(source.read(buildRead())).rejects.toThrow("offline");

  broken = false;
  await source.read(buildRead());

  expect(backend.fetches.map((context) => context.validator)).toEqual([
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
    fetch: () => {
      throw failure;
    },
  });

  await expect(source.read(buildRead())).rejects.toBe(failure);
});

test("selecting a view reads nothing and belongs to the source", () => {
  const backend = fakeBackend();
  const source = http({ fetch: backend.fetch });
  const projection = source.select((manifest) => manifest.web);

  expect(projection.source).toBe(source);
  expect(backend.fetches).toEqual([]);
});

const ALICE = { ...SCOPE, partition: "alice" };
const BOB = { ...SCOPE, partition: "bob" };

const readFor = (scope: typeof SCOPE) => ({ ...buildRead(), scope });

test("HTTP-02 the same scope for another partition is neither sent the validator nor renewed by it", async () => {
  const backend = fakeBackend();
  const source = http({ fetch: backend.fetch });

  await source.read(readFor(ALICE));
  await source.read(readFor(ALICE));
  await source.read(readFor(BOB));

  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    '"208"',
    null,
  ]);
});

test("HTTP-02 a not modified answer for another partition renews nothing of the first", async () => {
  const backend = fakeBackend();
  let notModified = false;

  const source = http({
    fetch: (context) => {
      if (notModified) {
        return { status: "not-modified" };
      }

      return backend.fetch(context);
    },
  });

  await source.read(readFor(ALICE));

  notModified = true;

  await expect(source.read(readFor(BOB))).rejects.toMatchObject({
    code: "SOURCE_FAILED",
  });
});

test("a partition that returns finds nothing to renew either, since the source keeps one answer", async () => {
  const backend = fakeBackend();
  const source = http({ fetch: backend.fetch });

  await source.read(readFor(ALICE));
  await source.read(readFor(BOB));
  await source.read(readFor(ALICE));

  expect(backend.fetches.map((context) => context.validator)).toEqual([
    null,
    null,
    null,
  ]);
});
