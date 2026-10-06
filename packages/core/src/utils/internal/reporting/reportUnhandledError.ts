// Thrown outside the current delivery, so the host's own error handling sees
// it and the listeners after the failing one still run.
export const reportUnhandledError = (error: unknown) => {
  queueMicrotask(() => {
    throw error;
  });
};
