import { parseUtcTimestamp } from "@priemskiyyy/beacon";

import { invalidManifest } from "src/utils/invalidManifest";

/** Epoch milliseconds of a field of the manifest that holds a UTC timestamp such as `2026-09-27T10:00:00Z`, and an invalid manifest when it is anything else. */
export const readTimestamp = (value: unknown, field: string): number => {
  if (typeof value !== "string") {
    throw invalidManifest(`${field} must be a timestamp.`);
  }

  const milliseconds = parseUtcTimestamp(value);

  if (milliseconds === undefined) {
    throw invalidManifest(
      `${field} must be a UTC timestamp such as 2026-09-27T10:00:00Z.`,
    );
  }

  return milliseconds;
};
