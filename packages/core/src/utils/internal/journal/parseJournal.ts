import type { StoredTransition } from "src/types/internal/StoredTransition";
import { JOURNAL_CAPACITY, JOURNAL_VERSION } from "src/utils/constants/journal";
import { readTransition } from "src/utils/internal/journal/readTransition";

/** More than a record of a few small transitions can be is not one. */
const MAXIMUM_LENGTH = 65_536;

/**
 * The transitions a persisted record holds, or `undefined` when it is
 * corrupt, from another version or larger than any record can be. Such a
 * record is ignored and never executed. The record is a trust boundary, so it
 * is validated field by field.
 */
export const parseJournal = (text: string): StoredTransition[] | undefined => {
  if (text.length > MAXIMUM_LENGTH) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }

  if (!("version" in parsed) || parsed.version !== JOURNAL_VERSION) {
    return undefined;
  }

  if (!("transitions" in parsed) || !Array.isArray(parsed.transitions)) {
    return undefined;
  }

  if (parsed.transitions.length > JOURNAL_CAPACITY) {
    return undefined;
  }

  const transitions: StoredTransition[] = [];

  for (const item of parsed.transitions) {
    const transition = readTransition(item);

    if (transition === undefined) {
      return undefined;
    }

    transitions.push(transition);
  }

  return transitions;
};
