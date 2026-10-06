import { isValidTime } from "src/utils/isValidTime";

/** The UTC value of a moment, for a row's title and its copied text. */
export const formatIsoTime = (timestamp: number) => {
  if (!isValidTime(timestamp)) {
    return "invalid time";
  }

  return new Date(timestamp).toISOString();
};
