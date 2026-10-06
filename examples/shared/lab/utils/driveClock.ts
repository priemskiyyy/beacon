import type { TestClock } from "@priemskiyyy/beacon/mock";

/**
 * Moves a test clock with real time, so the lab's clock behaves as a page's
 * does until a control skips ahead. Answers how to stop.
 */
export const driveClock = (clock: TestClock, interval: number) => {
  let last = performance.now();

  const timer = setInterval(() => {
    const now = performance.now();

    clock.advance(now - last);
    last = now;
  }, interval);

  return () => {
    clearInterval(timer);
  };
};
