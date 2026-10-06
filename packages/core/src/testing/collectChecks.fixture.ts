type Check = {
  title: string;
  run: (context: { skip: () => never }) => unknown;
};

const checks: Check[] = [];

class Skipped extends Error {}

const skip = (): never => {
  throw new Skipped();
};

/**
 * What a test file puts in place of `describe` and `test` of `vitest`, through
 * `vi.mock`, so that a conformance suite registers its checks here instead of
 * with the runner. The checks are then run by hand, and a storage or a reader
 * that breaks the contract can be shown failing the check that names it.
 */
export const collect = {
  describe: (_name: string, register: () => void) => {
    register();
  },
  test: (title: string, run: Check["run"]) => {
    checks.push({ title, run });
  },
};

/** Registers a suite through `register`, runs every check it collected, and answers how each ended. */
export const runCollected = async (register: () => void) => {
  checks.length = 0;
  register();

  const outcomes: Record<string, "passed" | "failed" | "skipped"> = {};

  for (const { title, run } of checks) {
    try {
      await run({ skip });
      outcomes[title] = "passed";
    } catch (error) {
      outcomes[title] = error instanceof Skipped ? "skipped" : "failed";
    }
  }

  return outcomes;
};

/** The titles of the checks that failed. */
export const listFailed = (outcomes: Record<string, string>) =>
  Object.entries(outcomes).flatMap(([title, outcome]) => {
    if (outcome === "failed") {
      return [title];
    }

    return [];
  });
