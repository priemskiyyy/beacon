import type { ObservableValue } from "@priemskiyyy/beacon";

import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";
import type { ObservedRoute } from "src/types/internal/ObservedRoute";

type Counter =
  | "status"
  | "running"
  | "support"
  | "transitions"
  | "diagnostics"
  | "events"
  | "routes"
  | "natives";

// Wraps a Beacon without changing it: every subscription the inspector makes is counted while it lives, which is what a leak looks like.
export const spyOnBeacon = <TBeacon extends ObservedBeacon>(
  beacon: TBeacon,
) => {
  const live: Record<Counter, number> = {
    status: 0,
    running: 0,
    support: 0,
    transitions: 0,
    diagnostics: 0,
    events: 0,
    routes: 0,
    natives: 0,
  };

  // What was read of a provider's handle, which must stay untouched while raw values are hidden.
  const reads = { natives: 0 };

  const subscriptions = () => Object.values(live).reduce((a, b) => a + b, 0);

  const count = <TValue>(
    name: Counter,
    value: ObservableValue<TValue>,
  ): ObservableValue<TValue> => ({
    get: value.get,
    getInitial: value.getInitial,
    subscribe: (listener) => {
      live[name] += 1;

      const unsubscribe = value.subscribe(listener);

      return () => {
        live[name] -= 1;
        unsubscribe();
      };
    },
  });

  const spyRoute = (route: ObservedRoute) =>
    new Proxy(route, {
      get: (target, key) => {
        if (key === "state") {
          return count("routes", target.state);
        }

        if (key === "native") {
          return {
            ...count("natives", target.native),
            get: () => {
              reads.natives += 1;

              return target.native.get();
            },
          };
        }

        return Reflect.get(target, key);
      },
    });

  const spied = new Proxy(beacon, {
    get: (target, key) => {
      if (key === "status") {
        return count("status", target.status);
      }

      if (key === "running") {
        return count("running", target.running);
      }

      if (key === "support") {
        return count("support", target.support);
      }

      if (key === "transitions") {
        return count("transitions", target.transitions);
      }

      if (key === "diagnostics") {
        const { diagnostics } = target;

        return {
          ...count("diagnostics", diagnostics),
          events: {
            subscribe: (
              listener: Parameters<typeof diagnostics.events.subscribe>[0],
            ) => {
              live.events += 1;

              const unsubscribe = diagnostics.events.subscribe(listener);

              return () => {
                live.events -= 1;
                unsubscribe();
              };
            },
          },
        };
      }

      if (key === "route") {
        return (name: string) => spyRoute(target.route(name));
      }

      return Reflect.get(target, key);
    },
  });

  return { beacon: spied, live, reads, subscriptions };
};
