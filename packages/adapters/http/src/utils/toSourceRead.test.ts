import { expect, test } from "vitest";

import { toSourceRead } from "src/utils/toSourceRead";

test("toSourceRead keeps the document and every piece of evidence given", () => {
  expect(
    toSourceRead({
      status: "changed",
      document: "manifest",
      validator: '"1"',
      revision: { kind: "opaque", value: "r1" },
      digest: "a",
      issuer: "service",
      expiresAt: 100,
    }),
  ).toEqual({
    document: "manifest",
    revision: { kind: "opaque", value: "r1" },
    digest: "a",
    issuer: "service",
    expiresAt: 100,
  });
});

test("toSourceRead leaves out evidence that was not given", () => {
  const read = toSourceRead({ status: "changed", document: "manifest" });

  expect(Object.keys(read)).toEqual(["document"]);
});
