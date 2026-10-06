import type { Beacon } from "src/utils/Beacon";
import type { RouteDefinition } from "src/types/RouteDefinition";

/**
 * Calls `onExpired` when a route's evidence goes from fresh to expired. The
 * core flips it at the authority's own `expiresAt` and publishes the route's
 * state, so hearing that arms no timer here. Answers how to stop listening.
 */
export const watchExpiry = <TRoutes extends Record<string, RouteDefinition>>(
  beacon: Beacon<TRoutes>,
  onExpired: () => void,
) => {
  const stops = beacon.routeNames.map((name) => {
    const route = beacon.route(name);

    const isFresh = () => {
      const { observation } = route.state.get();

      return (
        observation.status !== "unknown" &&
        observation.evidence.freshness === "fresh"
      );
    };

    let wasFresh = isFresh();

    return route.state.subscribe(() => {
      const fresh = isFresh();
      const lapsed = wasFresh && !fresh;

      wasFresh = fresh;

      if (!lapsed) {
        return;
      }

      onExpired();
    });
  });

  return () => {
    for (const stop of stops) {
      stop();
    }
  };
};
