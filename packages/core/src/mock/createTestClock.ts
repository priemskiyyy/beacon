import type { TestClock } from "src/mock/types/TestClock";

type Timer = { id: number; at: number; callback: () => void };

// Moved only forward, as time passes.
const assertForward = (milliseconds: number) => {
  if (Number.isFinite(milliseconds) && milliseconds >= 0) {
    return;
  }

  throw new Error("A test clock moves forward by zero or more milliseconds.");
};

// A platform timer treats a delay that is not positive, such as NaN, as none.
const toDelay = (milliseconds: number) => {
  if (milliseconds > 0) {
    return milliseconds;
  }

  return 0;
};

/**
 * A manual clock that starts at the given epoch time, zero by default, and runs
 * its timers only when a test advances it.
 *
 * @example
 * ```ts
 * const clock = createTestClock({ now: 1_000 });
 *
 * clock.setTimer(() => console.log(clock.now()), 500);
 * clock.advance(500); // logs 1_500
 * ```
 */
export const createTestClock = ({
  now: initialNow = 0,
}: { now?: number } = {}): TestClock => {
  // Timers follow the time that has passed, which `setNow` never changes.
  let wall = initialNow;
  let elapsed = 0;
  let nextId = 0;
  const timers = new Map<number, Timer>();

  const getNextDue = (limit: number) => {
    let next: Timer | null = null;

    for (const timer of timers.values()) {
      if (timer.at > limit) {
        continue;
      }

      if (next !== null && next.at <= timer.at) {
        continue;
      }

      next = timer;
    }

    return next;
  };

  const move = (milliseconds: number) => {
    wall += milliseconds;
    elapsed += milliseconds;
  };

  const run = (timer: Timer) => {
    timers.delete(timer.id);
    timer.callback();
  };

  return Object.freeze({
    now: () => wall,
    setTimer: (callback: () => void, delay: number) => {
      nextId += 1;

      const id = nextId;

      timers.set(id, { id, at: elapsed + toDelay(delay), callback });

      return () => {
        timers.delete(id);
      };
    },
    advance: (milliseconds: number) => {
      assertForward(milliseconds);

      const target = elapsed + milliseconds;

      let next = getNextDue(target);

      // An overdue timer runs now, never back at the time it fell due.
      while (next !== null) {
        move(Math.max(next.at - elapsed, 0));
        run(next);
        next = getNextDue(target);
      }

      // A timer that moved the clock past the target never moves it back.
      move(Math.max(target - elapsed, 0));
    },
    suspend: (milliseconds: number) => {
      assertForward(milliseconds);
      move(milliseconds);
    },
    setNow: (epochMilliseconds: number) => {
      wall = epochMilliseconds;
    },
    pendingTimers: () => timers.size,
  });
};
