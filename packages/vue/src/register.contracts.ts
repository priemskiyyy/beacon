// Typechecked, never run: what the composables take while `Register` names no Beacon,
// and what they take once it does. The tests of this package run under a
// registered Beacon, so a `Register` that merged nothing is written out here.
import { expectTypeOf } from "vitest";

import type { DriverBeacon, WebBeacon } from "src/beacon.fixture";
import type { BeaconOf } from "src/types/internal/BeaconOf";
import type { RoutesOf } from "src/types/internal/RoutesOf";
import type { UnregisteredRouteName } from "src/types/internal/UnregisteredRouteName";

type Unregistered = Record<never, never>;

declare const web: WebBeacon;
declare const ota: DriverBeacon;

// Whatever Beacon the application has fits the provider while nothing is registered, a feed route and a driver route alike.
export const webFits: BeaconOf<Unregistered> = web;
export const driverFits: BeaconOf<Unregistered> = ota;

// Once a Beacon is registered, the provider takes that one and no other.
expectTypeOf<BeaconOf<{ beacon: WebBeacon }>>().toEqualTypeOf<WebBeacon>();

// @ts-expect-error -- the registered Beacon has the route `web` and not the route `ota`.
export const otherThanRegistered: BeaconOf<{ beacon: WebBeacon }> = ota;

expectTypeOf<
  keyof RoutesOf<{ beacon: WebBeacon }> & string
>().toEqualTypeOf<"web">();

// While nothing is registered the only route name is the fix, so any other name fails and TypeScript prints the instruction.
expectTypeOf<
  keyof RoutesOf<Unregistered> & string
>().toEqualTypeOf<UnregisteredRouteName>();

export const readRoute = (name: keyof RoutesOf<Unregistered> & string) => name;

// @ts-expect-error -- a route name fails to compile until a Beacon is registered, and the error says how.
readRoute("web");

declare const unregistered: BeaconOf<Unregistered>;

// What does not need a route's name stays typed without a registration.
export const status = unregistered.status.get().state;
export const report = unregistered.check().then(({ routes }) => routes);

// @ts-expect-error -- the routes are read by the names the registered Beacon has, so there is no `route` to call without one.
unregistered.route("web");
