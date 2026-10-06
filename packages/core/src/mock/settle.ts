/**
 * Lets every promise continuation that is queued run before the test goes on,
 * by waiting for the host's next turn. It is a yield, never a wait for time:
 * Beacon's time is the test clock's.
 *
 * @example
 * ```ts
 * const pending = beacon.check();
 *
 * await settle();
 *
 * mock.resolve({ document: manifest });
 * await pending;
 * ```
 */
export const settle = (): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
