import type { RouteBody } from "src/types/RouteBody";
import type { RouteSnapshot } from "src/types/RouteSnapshot";

/** A route's snapshot with its offer and prepared types erased, as the runtime holds it. */
export type RouteState = RouteSnapshot<string, RouteBody, RouteBody>;
