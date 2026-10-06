import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import { SCOPE } from "src/fakeBackend.fixture";
import { NOW } from "src/standardManifest.fixture";
import type { OrderKind } from "src/types/OrderKind";
import { parseStandardManifest } from "src/parseStandardManifest";

// Named by a path, since the global `URL` is React Native's under the Hermes project and this reads files.
const here = path.dirname(fileURLToPath(import.meta.url));

// The manifest a page shows is the one its own declared routes read.
const readExample = (file: string) => {
  const fence = /```json\n([\s\S]*?)\n```/.exec(readFileSync(file, "utf8"));

  if (fence === null || fence[1] === undefined) {
    throw new Error(`${file} shows no manifest.`);
  }

  return fence[1];
};

const parseExample = (file: string, order: OrderKind) =>
  parseStandardManifest({
    text: readExample(file),
    scope: SCOPE,
    routes: { web: { kind: "target" }, binary: { kind: "candidate", order } },
    now: NOW,
  });

test("the manifest in the package README is a valid manifest for the routes it declares", () => {
  const read = parseExample(path.join(here, "../README.md"), "text");

  expect(read.document.routes.binary).toMatchObject({
    release: { order: "2.5.0" },
  });
  expect(read.document.support?.remediationRoute).toBe("web");
});

test("the manifest in the documentation page is a valid manifest for the routes it declares", () => {
  const read = parseExample(
    path.join(here, "../../../../docs/http.md"),
    "integer",
  );

  expect(read.document.routes.binary).toMatchObject({
    release: { order: 112 },
  });
});
