import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

import { SCOPE } from "src/fakeBackend.fixture";
import { NOW } from "src/standardManifest.fixture";
import type { OrderKind } from "src/types/OrderKind";
import { parseStandardManifest } from "src/parseStandardManifest";

// The manifest a page shows is the one its own declared routes read.
const readExample = (url: URL) => {
  const fence = /```json\n([\s\S]*?)\n```/.exec(readFileSync(url, "utf8"));

  if (fence === null || fence[1] === undefined) {
    throw new Error(`${url.pathname} shows no manifest.`);
  }

  return fence[1];
};

const parseExample = (url: URL, order: OrderKind) =>
  parseStandardManifest({
    text: readExample(url),
    scope: SCOPE,
    routes: { web: { kind: "target" }, binary: { kind: "candidate", order } },
    now: NOW,
  });

test("the manifest in the package README is a valid manifest for the routes it declares", () => {
  const read = parseExample(new URL("../README.md", import.meta.url), "text");

  expect(read.document.routes.binary).toMatchObject({
    release: { order: "2.5.0" },
  });
  expect(read.document.support?.remediationRoute).toBe("web");
});

test("the manifest in the documentation page is a valid manifest for the routes it declares", () => {
  const read = parseExample(
    new URL("../../../../docs/http.md", import.meta.url),
    "integer",
  );

  expect(read.document.routes.binary).toMatchObject({
    release: { order: 112 },
  });
});
