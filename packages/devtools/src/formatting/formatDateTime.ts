import { formatMoment } from "src/formatting/formatMoment";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Local date and time to the second, for evidence and the journal. */
export const formatDateTime = (timestamp: number) =>
  formatMoment(timestamp, dateTimeFormatter.format);
