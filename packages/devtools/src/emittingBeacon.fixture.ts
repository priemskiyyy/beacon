import type { BeaconDiagnosticEvent } from "@priemskiyyy/beacon";

import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";

/**
 * A view of a Beacon whose diagnostic events a test emits itself, so a failure
 * that is hard to cause, such as a throwing listener, can be told to the
 * inspector at once. Everything else is the Beacon's own.
 */
export const createEmittingBeacon = (beacon: ObservedBeacon) => {
  const listeners = new Set<(event: BeaconDiagnosticEvent) => void>();

  const observed: ObservedBeacon = {
    status: beacon.status,
    routeNames: beacon.routeNames,
    running: beacon.running,
    support: beacon.support,
    transitions: beacon.transitions,
    diagnostics: {
      ...beacon.diagnostics,
      events: {
        subscribe: (listener) => {
          listeners.add(listener);

          return () => {
            listeners.delete(listener);
          };
        },
      },
    },
    route: (name) => beacon.route(name),
    check: (options) => beacon.check(options),
  };

  /** Tells every listener one event, and answers the object it was told. */
  const emit = (event: Partial<BeaconDiagnosticEvent> = {}) => {
    const sent: BeaconDiagnosticEvent = {
      type: "session-started",
      timestamp: 1_700_000_000_000,
      session: 1,
      route: null,
      command: null,
      attempt: null,
      operation: null,
      reason: null,
      cause: null,
      ...event,
    };

    for (const listener of [...listeners]) {
      listener(sent);
    }

    return sent;
  };

  return { beacon: observed, emit, listeners: () => listeners.size };
};
