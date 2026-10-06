import { formatMoment } from "src/formatting/formatMoment";

/** The UTC value of a moment, for a row's title and its copied text. */
export const formatIsoTime = (timestamp: number) =>
  formatMoment(timestamp, (moment) => moment.toISOString());
