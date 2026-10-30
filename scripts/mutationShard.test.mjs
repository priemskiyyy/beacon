import assert from "node:assert/strict";
import { test } from "node:test";

import { selectMutationShard } from "./mutationShard.mjs";

test("an unsharded run retains every selected mutation", () => {
  const mutants = ["core", "expo", "browser"];

  assert.equal(selectMutationShard(mutants, undefined), mutants);
});

test("eight shards cover all 293 mutations exactly once", () => {
  const mutants = Array.from({ length: 293 }, (_, index) => index);

  const shards = Array.from({ length: 8 }, (_, index) =>
    selectMutationShard(mutants, `${index + 1}/8`),
  );

  const selected = shards.flat();

  assert.equal(selected.length, mutants.length);
  assert.equal(new Set(selected).size, mutants.length);
  assert.deepEqual(
    selected.toSorted((left, right) => left - right),
    mutants,
  );
  assert.ok(shards.every((shard) => shard.length > 0));
});

test("malformed, out-of-range and empty shards fail instead of skipping checks", () => {
  const mutants = Array.from({ length: 293 }, (_, index) => index);

  for (const value of [
    "",
    "0/8",
    "1/0",
    "9/8",
    "1",
    "1/2/3",
    "a/b",
    "-1/8",
    "1.5/8",
    "1/9007199254740992",
    "1/294",
  ]) {
    assert.throws(() => selectMutationShard(mutants, value), /shard/i);
  }
});
