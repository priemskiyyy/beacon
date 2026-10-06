import { isValidTime } from "src/utils/isValidTime";

// Local time, like the browser console. The row title carries the UTC value.
const eventTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
});

/** Local time of day with milliseconds. */
export const formatEventTime = (timestamp: number) => {
  if (!isValidTime(timestamp)) {
    return "invalid time";
  }

  return eventTimeFormatter.format(timestamp);
};
