import type { DriverContext } from "src/types/DriverContext";
import type { RouteBody } from "src/types/RouteBody";

/** What a prepared target of a route carries besides its reference; a feed route prepares nothing. */
export type PreparedBodyOf<TDefinition> = TDefinition extends {
  kind: "driver";
  driver: {
    open(context: DriverContext<RouteBody, infer TPrepared>): unknown;
  };
}
  ? TPrepared
  : RouteBody;
