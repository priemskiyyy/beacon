// Typechecked, never run: the inspector takes any Beacon, whatever its routes, and
// is typed down to what it reads, so it has nothing to start, stop, dispose or run.
import type { Beacon } from "@priemskiyyy/beacon";
import type { RouteDefinition, RunningSubject } from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import type { LabBeacon } from "src/beacon.fixture";
import { BeaconDevtools } from "src/BeaconDevtools";
import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";
import type { ObservedRoute } from "src/types/internal/ObservedRoute";
import type { RUNNING_SUBJECTS } from "src/utils/constants/subjects";

declare const lab: LabBeacon;
declare const empty: Beacon;
declare const widest: Beacon<Record<string, RouteDefinition>>;
declare const element: HTMLElement;

export const forABeaconOfItsOwnRoutes = new BeaconDevtools({ beacon: lab });

export const forABeaconOfNoRoutes = new BeaconDevtools({ beacon: empty });

export const forABeaconOfAnyRoutes = new BeaconDevtools({
  beacon: widest,
  initialIsOpen: true,
  maxEvents: 500,
});

export const swapped = () => {
  forABeaconOfItsOwnRoutes.setBeacon(widest);
  forABeaconOfItsOwnRoutes.setMaxEvents(50);
  forABeaconOfItsOwnRoutes.mount(element);
  forABeaconOfItsOwnRoutes.unmount();
};

// The overview lists every kind of running code the Beacon reads, so a new one does not compile until it is listed.
expectTypeOf<
  Exclude<RunningSubject, (typeof RUNNING_SUBJECTS)[number]>
>().toBeNever();

// A route handle keeps the commands the inspector must not call out of reach.
expectTypeOf<ObservedRoute>().toHaveProperty("state");
expectTypeOf<ObservedRoute>().not.toHaveProperty("reload");
expectTypeOf<ObservedRoute>().not.toHaveProperty("acknowledge");
expectTypeOf<ObservedRoute>().not.toHaveProperty("check");

// The Beacon it reads has no way to open, end or replace a session, and the one action it has is a check.
expectTypeOf<ObservedBeacon>().not.toHaveProperty("start");
expectTypeOf<ObservedBeacon>().not.toHaveProperty("stop");
expectTypeOf<ObservedBeacon>().not.toHaveProperty("dispose");
expectTypeOf<ObservedBeacon>().not.toHaveProperty("replaceScope");
expectTypeOf<ObservedBeacon>().not.toHaveProperty("reportReady");
expectTypeOf<ObservedBeacon>().not.toHaveProperty("clearJournal");
expectTypeOf<ObservedBeacon>().not.toHaveProperty("disruptions");
expectTypeOf<keyof ObservedBeacon>().toEqualTypeOf<
  | "status"
  | "routeNames"
  | "running"
  | "support"
  | "transitions"
  | "diagnostics"
  | "route"
  | "check"
>();

export const withoutDiagnostics = new BeaconDevtools({
  // @ts-expect-error -- the inspector reads the diagnostics.
  beacon: { status: lab.status },
});

export const withoutABeacon = new BeaconDevtools(
  // @ts-expect-error -- there is nothing to inspect without a Beacon.
  {},
);

export const withTextForACount = new BeaconDevtools({
  beacon: lab,
  // @ts-expect-error -- the number of events is a number.
  maxEvents: "many",
});

export const withoutAnElement = () => {
  // @ts-expect-error -- the panel mounts into an element.
  forABeaconOfItsOwnRoutes.mount("#root");
};
