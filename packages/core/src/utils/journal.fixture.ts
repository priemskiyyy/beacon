import type { MockJournalStorage } from "src/mock/types/MockJournalStorage";
import type { StoredTransition } from "src/types/internal/StoredTransition";
import type { TransitionIntent } from "src/types/TransitionIntent";
import { createJournalKey } from "src/utils/internal/journal/createJournalKey";
import { serializeJournal } from "src/utils/internal/journal/serializeJournal";
import { SCOPE } from "src/utils/Beacon.fixture";

export const KEY = createJournalKey(SCOPE);

export const buildIntent = (
  overrides: Partial<TransitionIntent> = {},
): TransitionIntent => ({
  operation: { id: 1 },
  boot: { id: "boot-1" },
  route: "web",
  command: "reload",
  subject: "web",
  current: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value: "web-build-b",
  },
  target: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value: "web-build-a",
  },
  binding: "unpinned-navigation",
  createdAt: 1_000,
  expiresAt: 87_401_000,
  ...overrides,
});

export const buildStored = (
  intent: TransitionIntent,
  outcome: StoredTransition["outcome"] = null,
  attempts = 0,
): StoredTransition => ({ intent, outcome, attempts });

/** Puts a record in storage as an earlier boot left it. */
export const seed = (
  memory: MockJournalStorage,
  transitions: StoredTransition[],
) => {
  memory.records.set(KEY, serializeJournal(transitions));
};
