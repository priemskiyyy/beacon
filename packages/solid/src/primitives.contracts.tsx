// Typechecked, never run: a route is named from the registered Beacon and its
// state is inferred from that route, equality takes only the selected type,
// every primitive returns a read-only accessor, and the provider takes the
// registered Beacon.
import type { Accessor } from "solid-js";
import { expectTypeOf } from "vitest";

import type { WebBeacon } from "src/beacon.fixture";
import { BeaconProvider } from "src/context/BeaconProvider";
import { useBeacon } from "src/primitives/useBeacon";
import { useObservable } from "src/primitives/useObservable";
import { useRoute } from "src/primitives/useRoute";
import { useRunning } from "src/primitives/useRunning";
import { useStatus } from "src/primitives/useStatus";
import type {
  RegisteredBeacon,
  RegisteredRouteState,
} from "src/types/Register";

declare const beacon: WebBeacon;

export const provider = (
  <BeaconProvider beacon={beacon} start>
    <span />
  </BeaconProvider>
);

expectTypeOf<RegisteredBeacon>().toEqualTypeOf<WebBeacon>();

export const useContracts = () => {
  const status: Accessor<"unknown" | "none" | "available" | "inconclusive"> =
    useRoute("web", ({ observation }) => observation.status);

  const checking: Accessor<boolean> = useRoute(
    "web",
    ({ check }) => check.state === "checking",
  );

  useRunning(({ web }) => web.state);
  useStatus(({ state }) => state);

  const handle = useBeacon()().route("web");

  expectTypeOf(useRoute("web")).toEqualTypeOf<
    Accessor<ReturnType<typeof handle.state.get>>
  >();

  expectTypeOf(useRoute("web")()).toEqualTypeOf<RegisteredRouteState<"web">>();

  useRoute("web", ({ check }) => check.state, {
    isEqual: (previous, next) => previous === next,
  });

  useRoute("web", ({ check }) => check.state, {
    // @ts-expect-error -- equality compares the selected type, nothing else.
    isEqual: (previous: number, next: number) => previous === next,
  });

  // @ts-expect-error -- a route that the registered Beacon does not have is not a name.
  useRoute("elsewhere");

  // @ts-expect-error -- a selection that reads a missing field fails to compile.
  useRoute("web", ({ observation }) => observation.missing);

  // @ts-expect-error -- a provider's Beacon has no unregistered route.
  useBeacon()().route("elsewhere");

  const route = useRoute("web");

  // @ts-expect-error -- the primitive returns an accessor to call, not the snapshot itself.
  const snapshot: RegisteredRouteState<"web"> = route;

  // @ts-expect-error -- an accessor is not a signal pair: nothing writes the value but the primitive.
  const [read, write] = route;

  // @ts-expect-error -- an accessor has no setter.
  route.set(route());

  // @ts-expect-error -- the provider's Beacon is read by calling the accessor, not by naming a route on it.
  useBeacon().route("web");

  expectTypeOf(useObservable(handle.native)).toEqualTypeOf<
    Accessor<ReturnType<typeof handle.native.get>>
  >();

  const selected: Accessor<string> = useObservable(
    handle.state,
    ({ check }) => check.state,
  );

  return { status, checking, snapshot, read, write, selected };
};
