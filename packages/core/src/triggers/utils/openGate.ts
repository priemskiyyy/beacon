import type { Beacon } from "src/utils/Beacon";
import type { CheckReason } from "src/types/CheckReason";
import type { CheckReport } from "src/types/CheckReport";
import type { RouteDefinition } from "src/types/RouteDefinition";

import type { CheckOnOptions } from "src/triggers/types/CheckOnOptions";
import type { TriggerTarget } from "src/triggers/types/TriggerTarget";
import {
  BACKOFF_ATTEMPTS,
  BACKOFF_JITTER,
  MIN_INTERVAL,
  SKIPPED_WHILE_FRESH,
} from "src/triggers/utils/constants/defaults";
import { watchExpiry } from "src/triggers/utils/watchExpiry";
import { MAX_TIMER_DELAY } from "src/utils/constants/timers";

// A failure the host will see is rethrown outside the call that met it, as Beacon does with a listener's.
const rethrowLater = (error: unknown) => {
  queueMicrotask(() => {
    throw error;
  });
};

/**
 * Opens the gate of one session: installs the triggers and judges every signal
 * they offer, in one place, so that signals of one moment cost one read, a
 * burst becomes one later start, and a failure backs off. Everything it holds
 * belongs to this session, so a session that ends takes it all, and the next
 * one starts with no failure counted and no start remembered. Answers how to
 * close it: every timer is cancelled and every trigger taken back.
 */
export const openGate = <TRoutes extends Record<string, RouteDefinition>>(
  beacon: Beacon<TRoutes>,
  options: CheckOnOptions,
) => {
  const {
    triggers,
    minInterval = MIN_INTERVAL,
    backoff = false,
    whileFresh = "check",
    onExpiry = false,
    random = Math.random,
    startup = true,
  } = options;

  const { clock } = beacon;
  const changeListeners = new Set<() => void>();
  const cleanups: Array<() => void> = [];

  let closed = false;
  let inFlight = 0;
  let failures = 0;
  let away = false;
  // The reason of a signal that came while a start was not allowed, which starts when it is.
  let waiting: CheckReason | null = null;
  // Timers: the least time between starts, and the wait after a failure.
  let cooling: (() => void) | null = null;
  let backingOff: (() => void) | null = null;

  // A clock that cannot arm a timer is contained as Beacon contains it: the wait is not made, and the host hears of it outside the call. A host timer holds a bounded delay, and one asked for more fires at once.
  const arm = (callback: () => void, delay: number) => {
    try {
      return clock.setTimer(callback, Math.min(delay, MAX_TIMER_DELAY));
    } catch (error) {
      rethrowLater(error);

      return null;
    }
  };

  const notifyChange = () => {
    for (const listener of [...changeListeners]) {
      try {
        listener();
      } catch (error) {
        rethrowLater(error);
      }
    }
  };

  // Every route holds evidence that can expire and has not: the authority said the answer still holds. A Beacon without routes has none to hold.
  const isFresh = () =>
    beacon.routeNames.length > 0 &&
    beacon.routeNames.every((name) => {
      const { observation } = beacon.route(name).state.get();

      return (
        observation.status !== "unknown" &&
        observation.evidence.expiresAt !== null &&
        observation.evidence.freshness === "fresh"
      );
    });

  // A network that came back is the reason a failed check may work now, so it does not wait out a backoff.
  const isBlocked = (reason: CheckReason) =>
    cooling !== null || (backingOff !== null && reason !== "reconnect");

  const wait = (reason: CheckReason) => {
    if (waiting !== null && reason !== "reconnect") {
      return;
    }

    waiting = reason;
  };

  const cancelBackoff = () => {
    backingOff?.();
    backingOff = null;
  };

  const judge = (report: CheckReport<string>) => {
    if (backoff === false) {
      return;
    }

    const outcomes = [...Object.values(report.routes), report.support];

    // A check that ends under a session that did not is superseded, and that only reaches a gate that is closed.
    if (!outcomes.some((outcome) => outcome?.status === "failed")) {
      failures = 0;
      cancelBackoff();

      return;
    }

    const {
      first,
      max,
      jitter = BACKOFF_JITTER,
      attempts = BACKOFF_ATTEMPTS,
    } = backoff;

    failures += 1;
    cancelBackoff();

    const base = Math.min(max, first * 2 ** (failures - 1));
    const delay = Math.min(max, base + base * jitter * random());

    backingOff = arm(() => {
      backingOff = null;

      if (failures <= attempts) {
        wait("retry");
      }

      release();
    }, delay);
  };

  const finish = (report: CheckReport<string>) => {
    inFlight -= 1;

    if (closed) {
      return;
    }

    judge(report);
    notifyChange();
  };

  const start = (reason: CheckReason) => {
    waiting = null;
    inFlight += 1;
    cooling = arm(() => {
      cooling = null;
      release();
    }, minInterval);

    const mode = reason === "reconnect" ? "after-current" : "join";

    beacon.check({ reason, mode }).then(finish);
  };

  const signal = (reason: CheckReason) => {
    if (closed) {
      return;
    }

    if (whileFresh === "skip" && SKIPPED_WHILE_FRESH.has(reason) && isFresh()) {
      return;
    }

    // The check in flight answers it, except a reconnect, which only a read that begins after it can answer.
    if (inFlight > 0 && reason !== "reconnect") {
      return;
    }

    if (isBlocked(reason)) {
      wait(reason);

      return;
    }

    start(reason);
  };

  // A wait ended: what came while it held starts now, unless another wait still holds it.
  const release = () => {
    const reason = waiting;

    waiting = null;

    if (reason === null) {
      return;
    }

    signal(reason);
  };

  const target: TriggerTarget = {
    signal,
    clock,
    random,
    isAway: () => away,
    setAway: (next) => {
      if (away === next) {
        return;
      }

      away = next;
      notifyChange();
    },
    onChange: (listener) => {
      changeListeners.add(listener);

      return () => {
        changeListeners.delete(listener);
      };
    },
  };

  // The first check of a session is the gate's, so that no trigger has to be listed for it and none can be forgotten.
  if (startup) {
    signal("startup");
  }

  for (const trigger of triggers) {
    try {
      cleanups.push(trigger(target));
    } catch (error) {
      rethrowLater(error);
    }
  }

  if (onExpiry) {
    cleanups.push(watchExpiry(beacon, () => signal("expiry")));
  }

  return () => {
    closed = true;
    cooling?.();
    cancelBackoff();
    changeListeners.clear();

    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch (error) {
        rethrowLater(error);
      }
    }
  };
};
