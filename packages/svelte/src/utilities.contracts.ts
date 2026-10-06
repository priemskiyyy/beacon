// Typechecked, never run: a route is named from the registered Beacon and its
// state is inferred from that route, equality takes only the selected type, the
// provider takes the registered Beacon, what a utility returns is read, never
// written, and the selector options are the core's.
import type { SelectorOptions as CoreSelectorOptions } from "@priemskiyyy/beacon";
import type { ComponentProps } from "svelte";
import { expectTypeOf } from "vitest";
import type { WebBeacon } from "./beacon.fixture.js";
import type BeaconProvider from "./context/BeaconProvider.svelte";
import type { SelectorOptions } from "./index.js";
import type { ReadableValue } from "./types/ReadableValue.js";
import type { RegisteredBeacon } from "./types/Register.js";
import { useBeacon } from "./utilities/useBeacon.js";
import { useObservable } from "./utilities/useObservable.js";
import { useRoute } from "./utilities/useRoute.js";
import { useRunning } from "./utilities/useRunning.js";
import { useBeaconStatus } from "./utilities/useBeaconStatus.js";

expectTypeOf<RegisteredBeacon>().toEqualTypeOf<WebBeacon>();
expectTypeOf<SelectorOptions<string>>().toEqualTypeOf<
  CoreSelectorOptions<string>
>();
expectTypeOf<
  ComponentProps<typeof BeaconProvider>["beacon"]
>().toEqualTypeOf<WebBeacon>();

// Whether the provider starts the session is a flag that may be left out, and then it starts.
expectTypeOf<ComponentProps<typeof BeaconProvider>["start"]>().toEqualTypeOf<
  boolean | undefined
>();

export const useContracts = () => {
  const status: ReadableValue<
    "unknown" | "none" | "available" | "inconclusive"
  > = useRoute("web", ({ observation }) => observation.status);

  const checking: ReadableValue<boolean> = useRoute(
    "web",
    ({ check }) => check.state === "checking",
  );

  useRunning(({ web }) => web.state);
  useBeaconStatus(({ state }) => state);

  expectTypeOf(useBeacon().current).toEqualTypeOf<WebBeacon>();

  expectTypeOf(useBeacon().current.route("web").state.get()).toEqualTypeOf<
    ReturnType<typeof useRoute<"web">>["current"]
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
  useBeacon().current.route("elsewhere");

  // @ts-expect-error -- what a utility returns is read, never written.
  status.current = "none";

  useObservable(useBeacon().current.route("web").native);

  return { status, checking };
};
