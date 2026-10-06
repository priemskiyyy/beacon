import { invalidManifest } from "src/utils/invalidManifest";

// A calendar date and a time of day in UTC, with the fraction of a second optional.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

// The length of `2026-09-27T10:00:00`, the part of a timestamp the engine may roll over.
const SECONDS_LENGTH = 19;

/**
 * Epoch milliseconds of a UTC timestamp such as `2026-09-27T10:00:00Z`. The
 * engine would roll `2026-02-31` over to March, so a timestamp counts only
 * when it names an instant that exists. A fraction of one or two digits is not
 * in the format the language defines, so the engine reads whole seconds and
 * the fraction is added here.
 */
export const readTimestamp = (value: unknown, field: string): number => {
  if (typeof value !== "string") {
    throw invalidManifest(`${field} must be a timestamp.`);
  }

  const seconds = value.slice(0, SECONDS_LENGTH);
  const milliseconds = Date.parse(`${seconds}Z`);

  if (
    !TIMESTAMP.test(value) ||
    Number.isNaN(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, SECONDS_LENGTH) !== seconds
  ) {
    throw invalidManifest(
      `${field} must be a UTC timestamp such as 2026-09-27T10:00:00Z.`,
    );
  }

  return (
    milliseconds + Number(value.slice(SECONDS_LENGTH + 1, -1).padEnd(3, "0"))
  );
};
