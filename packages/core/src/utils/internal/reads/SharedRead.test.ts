import { expect, test } from "vitest";

import { createTestClock } from "src/mock/createTestClock";
import type { BeaconError } from "src/utils/BeaconError";
import { createSession } from "src/utils/internal/feeds/FeedRecord.fixture";
import { SharedRead } from "src/utils/internal/reads/SharedRead";

const create = (accepted: () => void) => {
  const failures: BeaconError[] = [];

  const read = new SharedRead<string, string>({
    clock: createTestClock({ now: 1_000 }),
    timeout: 10_000,
    perform: async () => "answer",
    accept: (_attempt, answer) => answer,
    hooks: {
      started: () => {},
      accepted,
      failed: (_attempt, error) => {
        failures.push(error);
      },
      record: () => {},
    },
    errors: {
      failed: { code: "SOURCE_FAILED", message: "The read failed." },
      invalid: { code: "INVALID_DOCUMENT", message: "The answer is invalid." },
      timeout: { code: "SOURCE_TIMEOUT", message: "The read timed out." },
    },
  });

  return { read, failures };
};

test("an accepted hook that throws fails the read instead of leaving its callers waiting", async () => {
  let throws = true;

  const { read, failures } = create(() => {
    if (!throws) {
      return;
    }

    throw new Error("The owner could not install the answer.");
  });

  const session = createSession();

  await expect(
    read.read(session, { mode: "join", signal: undefined }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "INVALID_DOCUMENT" },
  });
  expect(failures).toHaveLength(1);

  throws = false;

  await expect(
    read.read(session, { mode: "join", signal: undefined }),
  ).resolves.toMatchObject({ status: "accepted" });
});
