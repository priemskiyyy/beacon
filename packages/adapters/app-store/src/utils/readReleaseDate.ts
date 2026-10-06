// A calendar date and a time of day in UTC, with the fraction of a second optional.
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?Z$/;

/**
 * Epoch milliseconds of a UTC timestamp such as `2026-09-02T09:15:00Z`, or
 * `undefined` when it is not one. The engine would roll `2026-02-31` over to
 * March and read `12` as a date, so a timestamp counts only when it names an
 * instant that exists.
 */
export const readReleaseDate = (text: string): number | undefined => {
  const match = TIMESTAMP.exec(text);
  const milliseconds = Date.parse(text);

  if (match === null || Number.isNaN(milliseconds)) {
    return undefined;
  }

  if (!new Date(milliseconds).toISOString().startsWith(match[1] ?? "")) {
    return undefined;
  }

  return milliseconds;
};
