import { expect, test } from "vitest";

import { Transaction } from "src/utils/internal/observable/Transaction";
import { ValueStore } from "src/utils/internal/observable/ValueStore";

test("CORE-07 every store of a transaction is installed before its first listener runs", () => {
  const revision = new ValueStore(1);
  const support = new ValueStore("unknown");
  const seen: Array<[number, string]> = [];

  revision.subscribe(() => seen.push([revision.get(), support.get()]));

  const transaction = new Transaction();

  transaction.set(revision, 2);
  transaction.set(support, "supported");

  expect(seen).toEqual([]);

  transaction.commit();
  expect(seen).toEqual([[2, "supported"]]);
});

test("a store set to its current value is not notified", () => {
  const store = new ValueStore(1);
  const seen: number[] = [];

  store.subscribe(() => seen.push(store.get()));

  const transaction = new Transaction();

  transaction.set(store, 1);
  transaction.commit();

  expect(seen).toEqual([]);
});

test("a store a nested transaction already announced is not announced again", () => {
  const first = new ValueStore(0);
  const second = new ValueStore(0);
  const heard: number[] = [];

  first.subscribe(() => {
    const nested = new Transaction();

    nested.set(second, 2);
    nested.commit();
  });
  second.subscribe(() => heard.push(second.get()));

  const outer = new Transaction();

  outer.set(first, 1);
  outer.set(second, 1);
  outer.commit();

  expect(heard).toEqual([2]);
});

test("an effect runs after every listener", () => {
  const store = new ValueStore(0);
  const log: string[] = [];

  store.subscribe(() => log.push("listener"));

  const transaction = new Transaction();

  transaction.set(store, 1);
  transaction.after(() => log.push("effect"));
  transaction.commit();

  expect(log).toEqual(["listener", "effect"]);
});
