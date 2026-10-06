/** Whether a number of milliseconds names a moment a date can hold; a clock that went wrong may say otherwise. */
export const isValidTime = (timestamp: number) =>
  Number.isFinite(new Date(timestamp).getTime());
