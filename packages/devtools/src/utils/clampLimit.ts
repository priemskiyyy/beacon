import { DEFAULT_MAX_EVENTS, EVENT_LIMIT } from "src/utils/constants/defaults";

/** Clamps `maxEvents` into range and falls back to the default for what is not a number. */
export const clampLimit = (limit: number) => {
  if (Number.isNaN(limit)) {
    return DEFAULT_MAX_EVENTS;
  }

  return Math.min(
    EVENT_LIMIT.max,
    Math.max(EVENT_LIMIT.min, Math.trunc(limit)),
  );
};
