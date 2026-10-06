import { describe, expect, test } from "vitest";

import { SCOPE } from "src/fakeBackend.fixture";
import {
  buildBinaryRoute,
  buildManifest,
  buildRelease,
  buildSupport,
  buildWebRoute,
  manifestWith,
  NOW,
  ROUTES,
} from "src/standardManifest.fixture";
import type { OrderKind } from "src/types/OrderKind";
import type { RouteDeclaration } from "src/types/RouteDeclaration";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import { parseStandardManifest } from "src/parseStandardManifest";

const parse = (text: string) =>
  parseStandardManifest({ text, scope: SCOPE, routes: ROUTES, now: NOW });

const VALID = JSON.stringify(buildManifest());

const expectRefused = (text: string, message: RegExp) => {
  expect(() => parse(text)).toThrow(
    expect.objectContaining({
      code: "INVALID_DOCUMENT",
      message: expect.stringMatching(message),
    }),
  );
};

const withRoutes = (web: unknown, binary: unknown = buildBinaryRoute()) =>
  manifestWith((manifest) => {
    manifest["routes"] = { web, binary };
  });

const withWebRelease = (release: unknown) =>
  withRoutes({ kind: "target", release });

const withTimes = (issuedAt: unknown, expiresAt: unknown) =>
  manifestWith((manifest) => {
    manifest["issuedAt"] = issuedAt;
    manifest["expiresAt"] = expiresAt;
  });

const withSupport = (support: unknown) =>
  manifestWith((manifest) => {
    manifest["support"] = support;
  });

test("a valid manifest is a typed document, the evidence to judge it by, and nothing else", () => {
  const read = parse(VALID);

  expect(read.document).toEqual({
    routes: {
      web: {
        kind: "target",
        release: {
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "web-artifact",
            value: "web-build-a",
          },
          label: "September recovery release",
          compatibility: { status: "not-applicable" },
          metadata: { releaseNotesKey: "recovery-208" },
        },
      },
      binary: {
        kind: "candidate",
        release: {
          identity: {
            status: "known",
            authority: "com.example.notes",
            domain: "ios-build",
            value: "412",
          },
          order: "2.5.0",
        },
      },
    },
    support: {
      revision: "policy-43",
      subject: "web",
      deniedReleaseIds: ["web-build-b"],
      reasonCode: "known-regression",
      remediationRoute: "web",
    },
  });

  expect(read.revision).toEqual({
    kind: "ordered",
    domain: "notes-web-deployments",
    epoch: "production-v1",
    value: "208",
  });

  expect(read.expiresAt).toBe(Date.parse("2026-09-27T10:10:00Z"));
  expect(read.digest).toMatch(/^[0-9a-f]{16}$/);
});

describe("an unknown schema version is refused before anything else is read", () => {
  test("HTTP-13 a version other than the one this parser reads", () => {
    for (const schemaVersion of [2, 0, "1", null]) {
      const text = manifestWith((manifest) => {
        manifest["schemaVersion"] = schemaVersion;
        manifest["routes"] = "not even read";
      });

      expectRefused(text, /schema version must be 1/);
    }
  });

  test("HTTP-13 a manifest with no schema version", () => {
    const text = manifestWith((manifest) => {
      delete manifest["schemaVersion"];
    });

    expectRefused(text, /schema version must be 1/);
  });
});

describe("a manifest for another scope is refused whole", () => {
  test("HTTP-14 another application, environment, platform or distribution", () => {
    for (const field of [
      "application",
      "environment",
      "platform",
      "distribution",
    ]) {
      const text = manifestWith((manifest) => {
        manifest[field] = "another";
      });

      expectRefused(text, new RegExp(`${field} is not the scope's`));
    }
  });

  test("HTTP-14 a scope field that is missing", () => {
    const text = manifestWith((manifest) => {
      delete manifest["environment"];
    });

    expectRefused(text, /environment must be a text/);
  });
});

describe("a missing route is not a decision to offer nothing", () => {
  test("HTTP-15 a declared route the manifest lacks", () => {
    const text = manifestWith((manifest) => {
      manifest["routes"] = { binary: buildBinaryRoute() };
    });

    expectRefused(text, /routes\.web is missing/);
  });

  test("HTTP-15 a route name only the prototype has is not a route", () => {
    // A literal `toString` key is typed as the method every object has.
    const entries: Array<[string, RouteDeclaration]> = [
      ["toString", { kind: "target" }],
    ];

    const routes: RouteDeclarations = Object.fromEntries(entries);

    expect(() =>
      parseStandardManifest({ text: VALID, scope: SCOPE, routes, now: NOW }),
    ).toThrow(/routes\.toString is missing/);
  });

  test("a route the application did not declare never reaches the document", () => {
    const read = parseStandardManifest({
      text: VALID,
      scope: SCOPE,
      routes: { web: { kind: "target" } },
      now: NOW,
    });

    expect(Object.keys(read.document.routes)).toEqual(["web"]);
  });
});

describe("a manifest that fails as a whole is never partly accepted", () => {
  test("HTTP-16 valid routes and a support block that is not", () => {
    const text = withSupport({ ...buildSupport(), subject: "browser" });

    expectRefused(text, /support\.subject must be a running subject/);
  });

  test("HTTP-16 a valid support block and a route that is not", () => {
    const text = withRoutes({
      kind: "target",
      release: { identity: { status: "known" } },
    });

    expectRefused(text, /routes\.web\.release\.identity\.authority/);
  });
});

describe("a decision has to be the kind its route declared", () => {
  test("a candidate on a target route", () => {
    expectRefused(
      withRoutes(buildBinaryRoute()),
      /routes\.web\.kind contradicts the route, which declares target/,
    );
  });

  test("a target on a candidate route", () => {
    expectRefused(
      withRoutes(buildWebRoute(), buildWebRoute()),
      /routes\.binary\.kind contradicts the route, which declares candidate/,
    );
  });

  test("an explicit none decision on either route", () => {
    const none = { kind: "none", reason: "up-to-date" };

    expect(parse(withRoutes(none, none)).document.routes).toEqual({
      web: none,
      binary: none,
    });
  });

  test.each(["install", "constructor"])("the kind %s", (kind) => {
    expectRefused(
      withRoutes({ kind }),
      /routes\.web\.kind must be one of none, target, candidate/,
    );
  });
});

describe("the order of a candidate is the kind its route declared", () => {
  const declare = (order: OrderKind, value: unknown) =>
    parseStandardManifest({
      text: withRoutes(buildWebRoute(), {
        kind: "candidate",
        release: { ...buildRelease("412", "ios-build"), order: value },
      }),
      scope: SCOPE,
      routes: { web: { kind: "target" }, binary: { kind: "candidate", order } },
      now: NOW,
    });

  test("a text order", () => {
    expect(declare("text", "2.5.0").document.routes.binary).toMatchObject({
      release: { order: "2.5.0" },
    });
  });

  test("an integer order", () => {
    expect(declare("integer", 42).document.routes.binary).toMatchObject({
      release: { order: 42 },
    });
  });

  test.each<[OrderKind, unknown]>([
    ["text", 42],
    ["text", ""],
    ["integer", "42"],
    ["integer", 4.5],
    ["integer", -1],
    ["integer", 2 ** 60],
  ])("a %s order of %j", (order, value) => {
    expect(() => declare(order, value)).toThrow(/order must/);
  });
});

describe("a release", () => {
  test("keeps only the label, compatibility and metadata it has", () => {
    const read = parse(withWebRelease(buildRelease("a")));

    expect(read.document.routes.web).toEqual({
      kind: "target",
      release: buildRelease("a"),
    });
  });

  test("with an unknown identity says why nothing identifies it", () => {
    const identity = { status: "unknown", reason: "not-reported" };

    expect(parse(withWebRelease({ identity })).document.routes.web).toEqual({
      kind: "target",
      release: { identity },
    });
  });

  test.each([
    { status: "compatible", basis: "runtime-version" },
    { status: "incompatible", reasons: ["runtime-too-old"] },
    { status: "delegated", authority: "google-play" },
    { status: "unknown", reason: "not-checked" },
    { status: "not-applicable" },
  ])("with the compatibility $status", (compatibility) => {
    const text = withWebRelease({ ...buildRelease("a"), compatibility });

    expect(parse(text).document.routes.web).toMatchObject({
      release: { compatibility },
    });
  });

  test.each([
    [{ status: "maybe" }, /compatibility\.status must be one of/],
    [{ status: "compatible" }, /compatibility\.basis must be a text/],
    [{ status: "incompatible", reasons: "old" }, /reasons must be a list/],
    [{ status: "incompatible", reasons: [1] }, /reasons\[0\] must be a text/],
  ])("with the compatibility %j refused", (compatibility, message) => {
    expectRefused(
      withWebRelease({ ...buildRelease("a"), compatibility }),
      message,
    );
  });

  test.each([
    [undefined, /routes\.web\.release must be an object/],
    [{}, /identity must be an object/],
    [{ identity: { status: "known" } }, /identity\.authority must be a text/],
    [{ identity: { status: "other" } }, /identity\.status must be one of/],
    [{ ...buildRelease("a"), label: 7 }, /release\.label must be a text/],
  ])("that is %j is refused", (release, message) => {
    expectRefused(withWebRelease(release), message);
  });
});

describe("a manifest beyond its bounds is refused", () => {
  const parseWithin = (text: string, bytes: number) =>
    parseStandardManifest({
      text,
      scope: SCOPE,
      routes: ROUTES,
      now: NOW,
      limits: { bytes },
    });

  test("HTTP-12 with more bytes than the limit", () => {
    expect(() => parseWithin(VALID, VALID.length - 1)).toThrow(
      /larger than \d+ bytes/,
    );
  });

  test("HTTP-12 with exactly the limit", () => {
    expect(parseWithin(VALID, VALID.length).document).toBeDefined();
  });

  test("HTTP-12 counted in bytes, not characters", () => {
    const text = manifestWith((manifest) => {
      manifest["note"] = "é".repeat(100);
    });

    // Each é is one character and two bytes.
    expect(parseWithin(text, text.length + 100).document).toBeDefined();
    expect(() => parseWithin(text, text.length + 99)).toThrow(/larger than/);
  });

  test("HTTP-12 with a list of more items than a list may have", () => {
    const deniedReleaseIds = Array.from(
      { length: 257 },
      (_, index) => `id-${index}`,
    );

    expectRefused(
      withSupport({ ...buildSupport(), deniedReleaseIds }),
      /deniedReleaseIds must have at most 256 items/,
    );
  });

  test("HTTP-12 with a text longer than a field may be", () => {
    expectRefused(
      withSupport({ ...buildSupport(), reasonCode: "x".repeat(257) }),
      /reasonCode must have 1 to 256 characters/,
    );
  });

  test("HTTP-12 with metadata of more entries than a release may carry", () => {
    const metadata = Object.fromEntries(
      Array.from({ length: 17 }, (_, index) => [`key-${index}`, "value"]),
    );

    expectRefused(
      withWebRelease({ ...buildRelease("a"), metadata }),
      /metadata must have at most 16 entries/,
    );
  });
});

describe("a manifest is JSON of the shape the schema names", () => {
  test("HTTP-08 an HTML login page, an empty body or a truncated document is not JSON", () => {
    for (const text of [
      "<!doctype html><title>Sign in</title>",
      "",
      '{"schemaVersion": 1, "routes": {',
    ]) {
      expectRefused(text, /not JSON/);
    }
  });

  test.each(["null", "[]", '"text"', "7"])("%s is not an object", (text) => {
    expectRefused(text, /must be an object/);
  });

  test.each(["__proto__", "constructor", "prototype"])(
    "the metadata key %s, which could corrupt a registry, is refused",
    (key) => {
      const text = VALID.replace('"releaseNotesKey"', JSON.stringify(key));

      expectRefused(text, new RegExp(`must not have the key ${key}`));
    },
  );

  test.each([
    ["an empty key", ""],
    ["a key of 257 characters", "k".repeat(257)],
  ])("%s is refused like any other text", (_name, key) => {
    expectRefused(
      withWebRelease({ ...buildRelease("a"), metadata: { [key]: "value" } }),
      /A key of routes\.web\.release\.metadata must have 1 to 256 characters/,
    );
  });

  test("a metadata value that is not text is refused", () => {
    expectRefused(
      withWebRelease({ ...buildRelease("a"), metadata: { notes: 7 } }),
      /metadata\.notes must be a text/,
    );
  });

  test("a field the schema does not name never reaches the document", () => {
    const text = manifestWith((manifest) => {
      manifest["extensions"] = { "com.example": { rollout: 50 } };
      manifest["unknownField"] = "ignored";
    });

    expect(parse(text).document).toEqual(parse(VALID).document);
  });

  test("a repeated key keeps its last value, and the document is checked as decoded", () => {
    const first = VALID.replace(
      '"schemaVersion":1',
      '"schemaVersion":2,"schemaVersion":1',
    );

    const last = VALID.replace(
      '"schemaVersion":1',
      '"schemaVersion":1,"schemaVersion":2',
    );

    expect(parse(first).document).toBeDefined();
    expectRefused(last, /schema version must be 1/);
  });
});

describe("the revision", () => {
  const withRevision = (revision: unknown) =>
    manifestWith((manifest) => {
      manifest["decisionRevision"] = revision;
    });

  test("can be opaque", () => {
    const revision = { kind: "opaque", value: "rollout-7" };

    expect(parse(withRevision(revision)).revision).toEqual(revision);
  });

  test("is text, so that no number size rounds it", () => {
    const revision = { kind: "ordered", domain: "d", epoch: "e", value: 208 };

    expectRefused(
      withRevision(revision),
      /decisionRevision\.value must be a text/,
    );
  });

  test("names its domain and epoch when it is ordered", () => {
    expectRefused(
      withRevision({ kind: "ordered", value: "208" }),
      /decisionRevision\.domain must be a text/,
    );
  });

  test("is one of the kinds the schema has", () => {
    expectRefused(
      withRevision({ kind: "sequence", value: "1" }),
      /decisionRevision\.kind must be one of opaque, ordered/,
    );
  });
});

describe("the times of a manifest hold or the manifest is refused", () => {
  test.each([
    ["a date that does not exist", "2026-02-31T10:00:00Z"],
    ["an hour that does not exist", "2026-09-27T24:00:00Z"],
    // V8 answers NaN for these three, and Hermes rolls each over to a date that exists.
    ["a month that does not exist", "2026-13-27T10:00:00Z"],
    ["a minute that does not exist", "2026-09-27T10:60:00Z"],
    ["a second that does not exist", "2026-09-27T10:00:60Z"],
    ["a local time", "2026-09-27T10:00:00+02:00"],
    ["a date without a time", "2026-09-27"],
    ["a number", 1_790_503_200_000],
    ["a word", "yesterday"],
    ["four digits of a second", "2026-09-27T10:00:00.1234Z"],
  ])("%s is not a timestamp", (_name, issuedAt) => {
    expectRefused(
      withTimes(issuedAt, "2026-09-27T10:10:00Z"),
      /issuedAt must be/,
    );
  });

  test.each([
    [".5", 500],
    [".05", 50],
    [".50", 500],
    [".123", 123],
  ])(
    "the fraction %s of a second is read as %i milliseconds",
    (fraction, milliseconds) => {
      const read = parse(
        withTimes("2026-09-27T10:00:00Z", `2026-09-27T10:10:00${fraction}Z`),
      );

      expect(read.expiresAt).toBe(
        Date.parse("2026-09-27T10:10:00Z") + milliseconds,
      );
    },
  );

  test("a manifest does not expire before it is issued", () => {
    expectRefused(
      withTimes("2026-09-27T10:10:00Z", "2026-09-27T10:00:00Z"),
      /expiresAt must not be before issuedAt/,
    );
  });

  test("a manifest lives no longer than the limit", () => {
    expectRefused(
      withTimes("2026-09-27T10:00:00Z", "2026-09-28T10:00:01Z"),
      /must not live longer than 86400000 milliseconds/,
    );
  });

  test("a manifest issued ahead of the local clock by more than the skew is refused", () => {
    expectRefused(
      withTimes("2026-09-27T10:10:01Z", "2026-09-27T10:20:00Z"),
      /issued more than 300000 milliseconds ahead of the local clock/,
    );
  });

  test("a manifest issued ahead of the local clock by less than the skew is read", () => {
    const text = withTimes("2026-09-27T10:09:00Z", "2026-09-27T10:20:00Z");

    expect(parse(text).expiresAt).toBe(Date.parse("2026-09-27T10:20:00Z"));
  });

  test("HTTP-17 a copy that has expired is refused, however it was served", () => {
    expectRefused(
      withTimes("2026-09-20T10:00:00Z", "2026-09-20T10:10:00Z"),
      /already expired/,
    );
  });

  test("a manifest is never valid for longer than the limit from now", () => {
    const read = parseStandardManifest({
      text: withTimes("2026-09-27T10:09:00Z", "2026-09-27T10:20:00Z"),
      scope: SCOPE,
      routes: ROUTES,
      now: NOW,
      limits: { lifetime: 660_000 },
    });

    expect(read.expiresAt).toBe(NOW + 660_000);
  });
});

describe("the fingerprint", () => {
  test("stays the same when only the times of the same decision change", () => {
    const renewed = parse(
      withTimes("2026-09-27T10:03:00Z", "2026-09-27T10:13:00Z"),
    );

    expect(renewed.digest).toBe(parse(VALID).digest);
    expect(renewed.expiresAt).not.toBe(parse(VALID).expiresAt);
  });

  test("changes with a decision", () => {
    const other = parse(
      withWebRelease({ ...buildRelease("web-build-c"), label: "Another" }),
    );

    expect(other.digest).not.toBe(parse(VALID).digest);
  });

  test("stays the same when only the support facts change, since they carry a revision of their own", () => {
    const other = parse(
      withSupport({
        ...buildSupport(),
        revision: "policy-44",
        deniedReleaseIds: ["web-build-b", "web-build-c"],
      }),
    );

    expect(other.digest).toBe(parse(VALID).digest);
    expect(other.document.support?.revision).toBe("policy-44");
  });

  test("stays the same when metadata is written in another order", () => {
    const first = parse(
      withWebRelease({
        ...buildRelease("a"),
        metadata: { alpha: "a", beta: "b" },
      }),
    );

    const second = parse(
      withWebRelease({
        ...buildRelease("a"),
        metadata: { beta: "b", alpha: "a" },
      }),
    );

    expect(second.digest).toBe(first.digest);
  });
});

describe("the support facts", () => {
  test("are null when the manifest has none", () => {
    const text = manifestWith((manifest) => {
      delete manifest["support"];
    });

    expect(parse(text).document.support).toBeNull();
  });

  test.each([
    [
      { ...buildSupport(), remediationRoute: "elsewhere" },
      /remediationRoute must be a declared route/,
    ],
    [
      // A name every object has is not a route the application declared.
      { ...buildSupport(), remediationRoute: "toString" },
      /remediationRoute must be a declared route/,
    ],
    [
      { ...buildSupport(), subject: "toaster" },
      /subject must be a running subject/,
    ],
    [
      { ...buildSupport(), deniedReleaseIds: "web-build-b" },
      /deniedReleaseIds must be a list/,
    ],
    [{ ...buildSupport(), revision: undefined }, /revision must be a text/],
    ["policy", /support must be an object/],
  ])("%j is refused", (support, message) => {
    expectRefused(withSupport(support), message);
  });
});
