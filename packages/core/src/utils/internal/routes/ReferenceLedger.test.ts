import { expect, test } from "vitest";

import { ReferenceLedger } from "src/utils/internal/routes/ReferenceLedger";

test("BIND-03 a minted reference is owned, and a copy or a forgery is not", () => {
  const ledger = new ReferenceLedger();
  const reference = ledger.mintOffer("web");

  expect(ledger.owns(reference)).toBe(true);
  expect(ledger.owns({ ...reference })).toBe(false);
  expect(ledger.owns({ kind: "offer", route: "web", id: 1 })).toBe(false);
});

test("a reference of another ledger is not owned", () => {
  const first = new ReferenceLedger();
  const second = new ReferenceLedger();

  expect(second.owns(first.mintPrepared("ota"))).toBe(false);
});

test("references are frozen, numbered and named for their route and kind", () => {
  const ledger = new ReferenceLedger();

  const offer = ledger.mintOffer("web");
  const prepared = ledger.mintPrepared("ota");

  expect(offer).toEqual({ kind: "offer", route: "web", id: 1 });
  expect(prepared).toEqual({ kind: "prepared", route: "ota", id: 2 });
  expect(Object.isFrozen(offer)).toBe(true);
});
