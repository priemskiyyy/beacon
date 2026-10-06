import type {
  Impact,
  ObservableValue,
  Release,
  RouteSnapshot,
  TargetBinding,
} from "@priemskiyyy/beacon";

type Body = { release: Release<object | null> };

// Written out rather than picked from a route handle, whose commands are exactly what the inspector must not be able to call.
export type ObservedRoute = {
  state: ObservableValue<RouteSnapshot<string, Body, Body>>;
  native: ObservableValue<object | null>;
  capabilities: Record<
    string,
    { reference: string; impacts: Impact[]; binding: TargetBinding }
  >;
};
