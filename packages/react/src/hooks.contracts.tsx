// Typechecked, never run: a route is named from the registered Beacon and its
// state is inferred from that route, equality takes only the selected type, the
// provider takes the registered Beacon, and the selector options are the core's.
import type { SelectorOptions as CoreSelectorOptions } from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import { BeaconProvider } from "src/context/BeaconProvider";
import type { WebBeacon } from "src/beacon.fixture";
import { useBeacon } from "src/hooks/useBeacon";
import { useObservable } from "src/hooks/useObservable";
import { useRoute } from "src/hooks/useRoute";
import { useRunning } from "src/hooks/useRunning";
import { useStatus } from "src/hooks/useStatus";
import type { SelectorOptions } from "src/index";
import type { RegisteredBeacon } from "src/types/Register";

declare const beacon: WebBeacon;

export const provider = <BeaconProvider beacon={beacon} start />;

expectTypeOf<RegisteredBeacon>().toEqualTypeOf<WebBeacon>();
expectTypeOf<SelectorOptions<string>>().toEqualTypeOf<
  CoreSelectorOptions<string>
>();

export const useContracts = () => {
  const status: "unknown" | "none" | "available" | "inconclusive" = useRoute(
    "web",
    ({ observation }) => observation.status,
  );

  const checking: boolean = useRoute(
    "web",
    ({ check }) => check.state === "checking",
  );

  useRunning(({ web }) => web.state);
  useStatus(({ state }) => state);

  expectTypeOf(useBeacon().route("web").state.get()).toEqualTypeOf<
    ReturnType<typeof useRoute<"web">>
  >();

  useRoute("web", ({ check }) => check.state, {
    // @ts-expect-error -- equality compares the selected type, nothing else.
    isEqual: (previous: number, next: number) => previous === next,
  });

  // @ts-expect-error -- a route that the registered Beacon does not have is not a name.
  useRoute("elsewhere");

  // @ts-expect-error -- a selection that reads a missing field fails to compile.
  useRoute("web", ({ observation }) => observation.missing);

  // @ts-expect-error -- a provider's Beacon has no unregistered route.
  useBeacon().route("elsewhere");

  useObservable(useBeacon().route("web").native);

  return { status, checking };
};
