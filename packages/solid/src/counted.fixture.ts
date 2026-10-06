import type { DisruptionParticipant } from "@priemskiyyy/beacon";

import { countListeners } from "src/beacon.fixture";
import type { WebBeacon } from "src/beacon.fixture";

// A view of a Beacon that counts what the primitives hold on it: the live listeners of each observable and the live registrations. A leak is a count that stays above zero.
export const countBeacon = (beacon: WebBeacon) => {
  const route = countListeners(beacon.route("web").state);
  const status = countListeners(beacon.status);
  const running = countListeners(beacon.running);
  const support = countListeners(beacon.support);
  const transitions = countListeners(beacon.transitions);
  const registrations = { live: 0, total: 0 };

  const counted: WebBeacon = Object.create(beacon, {
    status: { value: status.observable },
    running: { value: running.observable },
    support: { value: support.observable },
    transitions: { value: transitions.observable },
    route: {
      value: (name: "web") => ({
        ...beacon.route(name),
        state: route.observable,
      }),
    },
    disruptions: {
      value: {
        register: (participant: DisruptionParticipant) => {
          registrations.live += 1;
          registrations.total += 1;

          const unregister = beacon.disruptions.register(participant);

          return () => {
            registrations.live -= 1;
            unregister();
          };
        },
      },
    },
  });

  return {
    beacon: counted,
    listeners: () => ({
      route: route.listeners(),
      status: status.listeners(),
      running: running.listeners(),
      support: support.listeners(),
      transitions: transitions.listeners(),
    }),
    registrations,
  };
};
