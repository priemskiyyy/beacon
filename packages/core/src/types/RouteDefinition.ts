import type { CommandMap } from "src/types/CommandMap";
import type { DriverRoute } from "src/types/DriverRoute";
import type { FeedRoute } from "src/types/FeedRoute";
import type { Release } from "src/types/Release";
import type { RouteBody } from "src/types/RouteBody";

/**
 * Any route an application can pass to `routes`, seen at its widest. It is
 * the constraint of `Beacon`: each route keeps its own precise type, and the
 * handle of `beacon.route(name)` is derived from it.
 *
 * @example
 * ```ts
 * const routes: Record<string, RouteDefinition> = { web, ota };
 * ```
 */
export type RouteDefinition =
  | FeedRoute<
      unknown,
      Release<object | null>,
      object,
      CommandMap<object, RouteBody, RouteBody>
    >
  | DriverRoute<
      object,
      RouteBody,
      RouteBody,
      CommandMap<object, RouteBody, RouteBody>
    >;
