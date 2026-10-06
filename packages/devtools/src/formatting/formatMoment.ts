/** Writes a moment with `format`, or says the time is invalid: a clock that went wrong may name a time a date cannot hold. */
export const formatMoment = (
  timestamp: number,
  format: (moment: Date) => string,
) => {
  const moment = new Date(timestamp);

  if (Number.isNaN(moment.getTime())) {
    return "invalid time";
  }

  return format(moment);
};
