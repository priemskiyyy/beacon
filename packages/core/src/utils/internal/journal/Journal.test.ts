import { expect, test } from "vitest";

import { createTestClock } from "src/mock/createTestClock";
import type { IntentDraft } from "src/types/internal/IntentDraft";
import { SCOPE } from "src/utils/Beacon.fixture";
import { Journal } from "src/utils/internal/journal/Journal";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { ResourceScope } from "src/utils/internal/runtime/ResourceScope";
import { buildIntent, createMemoryStorage } from "src/utils/journal.fixture";

const DRAFT: IntentDraft = buildIntent();

test("a hydration that fails leaves the queue working for what is queued behind it", async () => {
  const failure = new Error("The running facts could not be read.");

  const journal = new Journal({
    options: {
      mode: "required",
      storage: createMemoryStorage().storage,
      budget: 3,
      retention: 86_400_000,
    },
    getScope: () => SCOPE,
    getRunning: () => Promise.reject(failure),
    clock: createTestClock({ now: 1_000 }),
    listeners: new Listeners(() => {}),
    record: () => {},
  });

  const session = { id: 1, scope: new ResourceScope(() => {}) };

  const hydrating = journal.hydrate(session);
  const writing = journal.write(DRAFT);

  await expect(hydrating).rejects.toBe(failure);

  // The record was never read, so the write is refused: an answer, not a write that never comes.
  await expect(writing).resolves.toMatchObject({ status: "failed" });
});
