// A calendar date and a time of day in UTC, with the fraction of a second optional.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

// The length of `2026-09-02T09:15:00`, the part of a timestamp the engine may roll over.
const SECONDS_LENGTH = 19;

/**
 * Epoch milliseconds of a UTC timestamp such as `2026-09-02T09:15:00Z`, or
 * `undefined` when it is not one. The engine would roll `2026-02-31` over to
 * March and read `12` as a date, so a timestamp counts only when it names an
 * instant that exists.
 */
export const readReleaseDate = (text: string): number | undefined => {
  const milliseconds = Date.parse(text);

  if (!TIMESTAMP.test(text) || Number.isNaN(milliseconds)) {
    return undefined;
  }

  const instant = new Date(milliseconds).toISOString();

  if (instant.slice(0, SECONDS_LENGTH) !== text.slice(0, SECONDS_LENGTH)) {
    return undefined;
  }

  return milliseconds;
};
