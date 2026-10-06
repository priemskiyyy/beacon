import { expect, test } from "vitest";

import { BeaconError } from "src/utils/BeaconError";
import { custom } from "src/utils/versions/custom";

type Revision = { train: string; sequence: number };

const parseRevision = (input: string): Revision => {
  const [train, sequence] = input.split(":");

  if (train === undefined || sequence === undefined) {
    throw new BeaconError({
      code: "INVALID_VERSION",
      message: "A revision is train:sequence.",
    });
  }

  return { train, sequence: Number(sequence) };
};

const strategy = custom({
  name: "release-train",
  parse: parseRevision,
  compare: (candidate, current) => {
    if (candidate.train !== current.train) {
      return "incomparable";
    }

    if (candidate.sequence === current.sequence) {
      return "equal";
    }

    if (candidate.sequence > current.sequence) {
      return "newer";
    }

    return "older";
  },
});

test("a custom strategy keeps its name, parser and comparator", () => {
  const candidate = strategy.parse("stable:8");

  expect(strategy.name).toBe("release-train");
  expect(candidate).toEqual({ train: "stable", sequence: 8 });
  expect(strategy.compare(candidate, strategy.parse("stable:7"))).toBe("newer");
});

test("VER-18 revisions of different trains are incomparable, never guessed", () => {
  expect(
    strategy.compare(strategy.parse("beta:9"), strategy.parse("stable:2")),
  ).toBe("incomparable");
});

test("a custom strategy admits everything unless it says otherwise", () => {
  const admitting = strategy.parse("stable:1");

  const selective = custom({
    name: "selective",
    parse: parseRevision,
    compare: () => "equal",
    admits: (candidate) => candidate.train === "stable",
  });

  expect(strategy.admits(admitting)).toBe(true);
  expect(selective.admits(admitting)).toBe(true);
  expect(selective.admits(selective.parse("beta:1"))).toBe(false);
});
