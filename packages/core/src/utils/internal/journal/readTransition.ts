import type { StoredTransition } from "src/types/internal/StoredTransition";
import type { ReconciliationOutcome } from "src/types/ReconciliationOutcome";
import type { RunningSubject } from "src/types/RunningSubject";
import type { TargetBinding } from "src/types/TargetBinding";
import { TARGET_BINDINGS } from "src/utils/constants/commands";
import { RUNNING_SUBJECTS } from "src/utils/constants/subjects";
import { readNullableIdentity } from "src/utils/internal/journal/readNullableIdentity";

const OUTCOMES: ReconciliationOutcome[] = [
  "same-boot",
  "target-running",
  "target-not-running",
  "different-target",
  "inconclusive",
];

const readSubject = (value: unknown): RunningSubject | undefined =>
  RUNNING_SUBJECTS.find((subject) => subject === value);

const BINDINGS = new Map<string, TargetBinding>(
  Object.values(TARGET_BINDINGS).map((binding) => [binding, binding]),
);

const readBinding = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  return BINDINGS.get(value);
};

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

const readObject = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  return Object.getOwnPropertyDescriptor(value, key)?.value;
};

type OutcomeRead =
  { valid: true; outcome: ReconciliationOutcome | null } | { valid: false };

const readOutcome = (value: unknown): OutcomeRead => {
  if (value === null) {
    return { valid: true, outcome: null };
  }

  const outcome = OUTCOMES.find((candidate) => candidate === value);

  if (outcome === undefined) {
    return { valid: false };
  }

  return { valid: true, outcome };
};

/**
 * One persisted transition, or `undefined` when any field breaks the layout.
 * Nothing that was read is executed, and nothing is half trusted: a record with
 * one bad transition is ignored whole.
 */
export const readTransition = (
  value: unknown,
): StoredTransition | undefined => {
  const intent = readObject(value, "intent");

  const operation = readInteger(
    readObject(readObject(intent, "operation"), "id"),
  );

  const boot = readObject(readObject(intent, "boot"), "id");
  const route = readObject(intent, "route");
  const command = readObject(intent, "command");
  const subject = readSubject(readObject(intent, "subject"));
  const current = readNullableIdentity(readObject(intent, "current"));
  const target = readNullableIdentity(readObject(intent, "target"));
  const binding = readBinding(readObject(intent, "binding"));
  const createdAt = readTime(readObject(intent, "createdAt"));
  const expiresAt = readTime(readObject(intent, "expiresAt"));
  const attempts = readInteger(readObject(value, "attempts"));
  const outcome = readOutcome(readObject(value, "outcome"));

  if (
    operation === undefined ||
    typeof boot !== "string" ||
    typeof route !== "string" ||
    typeof command !== "string" ||
    subject === undefined ||
    !current.valid ||
    !target.valid ||
    binding === undefined ||
    createdAt === undefined ||
    expiresAt === undefined ||
    attempts === undefined ||
    attempts < 0 ||
    !outcome.valid
  ) {
    return undefined;
  }

  return {
    intent: {
      operation: { id: operation },
      boot: { id: boot },
      route,
      command,
      subject,
      current: current.identity,
      target: target.identity,
      binding,
      createdAt,
      expiresAt,
    },
    outcome: outcome.outcome,
    attempts,
  };
};
