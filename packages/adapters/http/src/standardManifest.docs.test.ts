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

// The manifests a page shows, in the order it shows them, are the ones its own declared routes read.
const readExamples = (file: string) => {
  const fences = [
    ...readFileSync(file, "utf8").matchAll(/```json\n([\s\S]*?)\n```/g),
  ];

  return fences.map((fence) => fence[1] ?? "");
};

const parseExample = (text: string | undefined, order: OrderKind) => {
  if (text === undefined) {
    throw new Error("The page shows no such manifest.");
  }

  return parseStandardManifest({
    text,
    scope: SCOPE,
    routes: {
      web: { kind: "target" },
      binary: { kind: "candidate", order, domain: "android-version-code" },
    },
    now: NOW,
  });
};

test("the manifest in the package README is a valid manifest for the routes it declares", () => {
  const examples = readExamples(path.join(here, "../README.md"));
  const read = parseExample(examples[1], "text");

  expect(read.document.routes.binary).toMatchObject({
    release: { order: "2.5.0" },
  });
  expect(read.document.support?.remediationRoute).toBe("web");
});

test.each([
  ["package README", "../README.md"],
  ["documentation page", "../../../../docs/http.md"],
])(
  "the file of a static host in the %s is a manifest with nothing but the decision",
  (_name, file) => {
    const [example] = readExamples(path.join(here, file));

    const read = parseStandardManifest({
      text: example ?? "",
      scope: SCOPE,
      routes: { web: { kind: "target" } },
      now: NOW,
    });

    expect(read.document.routes.web).toEqual({
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
    expect(read.revision).toBeUndefined();
  },
);

test("the manifest in the documentation page is a valid manifest for the routes it declares", () => {
  const examples = readExamples(path.join(here, "../../../../docs/http.md"));
  const read = parseExample(examples[1], "integer");

  expect(read.document.routes.binary).toMatchObject({
    release: {
      identity: { domain: "android-version-code", value: "112" },
      order: 112,
    },
  });
});
