import type { StoredTransition } from "src/types/internal/StoredTransition";
import type { ReconciliationOutcome } from "src/types/ReconciliationOutcome";
import { TARGET_BINDINGS } from "src/utils/constants/commands";
import { RUNNING_SUBJECTS } from "src/utils/constants/subjects";
import { freezeIntent } from "src/utils/internal/journal/freezeIntent";
import { readField } from "src/utils/internal/journal/readField";
import { readIdentity } from "src/utils/internal/journal/readIdentity";

const OUTCOMES: ReconciliationOutcome[] = [
  "same-boot",
  "target-running",
  "target-not-running",
  "different-target",
  "inconclusive",
];

const readSubject = (value: unknown) =>
  RUNNING_SUBJECTS.find((subject) => subject === value);

const readBinding = (value: unknown) =>
  Object.values(TARGET_BINDINGS).find((binding) => binding === value);

const readInteger = (value: unknown) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return undefined;
  }

  return value;
};

const readTime = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
};

// `null` is a valid answer where nothing was known or judged, so `undefined` is left to say the layout broke.
const readNullableIdentity = (value: unknown) => {
  if (value === null) {
    return null;
  }

  return readIdentity(value);
};

const readOutcome = (value: unknown) => {
  if (value === null) {
    return null;
  }

  return OUTCOMES.find((outcome) => outcome === value);
};

/**
 * One persisted transition, or `undefined` when any field breaks the layout.
 * Nothing that was read is executed, and nothing is half trusted: a record with
 * one bad transition is ignored whole.
 */
export const readTransition = (
  value: unknown,
): StoredTransition | undefined => {
  const intent = readField(value, "intent");

  const operation = readInteger(
    readField(readField(intent, "operation"), "id"),
  );

  const boot = readField(readField(intent, "boot"), "id");
  const route = readField(intent, "route");
  const command = readField(intent, "command");
  const subject = readSubject(readField(intent, "subject"));
  const current = readNullableIdentity(readField(intent, "current"));
  const target = readNullableIdentity(readField(intent, "target"));
  const binding = readBinding(readField(intent, "binding"));
  const createdAt = readTime(readField(intent, "createdAt"));
  const expiresAt = readTime(readField(intent, "expiresAt"));
  const attempts = readInteger(readField(value, "attempts"));
  const outcome = readOutcome(readField(value, "outcome"));

  if (
    operation === undefined ||
    typeof boot !== "string" ||
    typeof route !== "string" ||
    typeof command !== "string" ||
    subject === undefined ||
    current === undefined ||
    target === undefined ||
    binding === undefined ||
    createdAt === undefined ||
    expiresAt === undefined ||
    attempts === undefined ||
    attempts < 0 ||
    outcome === undefined
  ) {
    return undefined;
  }

  return {
    intent: freezeIntent({
      operation: { id: operation },
      boot: { id: boot },
      route,
      command,
      subject,
      current,
      target,
      binding,
      createdAt,
      expiresAt,
    }),
    outcome,
    attempts,
  };
};
