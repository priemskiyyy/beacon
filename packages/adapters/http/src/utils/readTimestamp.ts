import { invalidManifest } from "src/utils/invalidManifest";

// A calendar date and a time of day in UTC, with the fraction of a second optional.
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{1,3})?Z$/;

/**
 * Epoch milliseconds of a UTC timestamp such as `2026-09-27T10:00:00Z`. The
 * engine would roll `2026-02-31` over to March, so a timestamp counts only
 * when it names an instant that exists.
 */
export const readTimestamp = (value: unknown, field: string): number => {
  if (typeof value !== "string") {
    throw invalidManifest(`${field} must be a timestamp.`);
  }

  const match = TIMESTAMP.exec(value);
  const milliseconds = Date.parse(value);

  if (
    match === null ||
    Number.isNaN(milliseconds) ||
    !new Date(milliseconds).toISOString().startsWith(match[1] ?? "")
  ) {
    throw invalidManifest(
      `${field} must be a UTC timestamp such as 2026-09-27T10:00:00Z.`,
    );
  }

  return milliseconds;
};
