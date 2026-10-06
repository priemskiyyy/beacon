// Typechecked, never run: a route is named from the registered Beacon and its
// state is inferred from that route, equality takes only the selected type,
// every value a composable returns is read-only, the provider takes the
// registered Beacon, and the selector options are the core's.
import type { SelectorOptions as CoreSelectorOptions } from "@priemskiyyy/beacon";
import { h } from "vue";
import type { ComputedRef } from "vue";
import { expectTypeOf } from "vitest";

import type { WebBeacon } from "src/beacon.fixture";
import { useBeacon } from "src/composables/useBeacon";
import { useObservable } from "src/composables/useObservable";
import { useRoute } from "src/composables/useRoute";
import { useRunning } from "src/composables/useRunning";
import { useBeaconStatus } from "src/composables/useBeaconStatus";
import { BeaconProvider } from "src/context/BeaconProvider";
import type { SelectorOptions } from "src/index";
import type { RegisteredBeacon } from "src/types/Register";

declare const beacon: WebBeacon;

export const provider = h(BeaconProvider, { beacon });

export const providerThatLeavesTheSessionToTheApplication = h(BeaconProvider, {
  beacon,
  start: false,
});

// @ts-expect-error -- a provider without a Beacon publishes nothing.
h(BeaconProvider, {});

// @ts-expect-error -- `start` is a flag.
h(BeaconProvider, { beacon, start: "yes" });

expectTypeOf<RegisteredBeacon>().toEqualTypeOf<WebBeacon>();
expectTypeOf<SelectorOptions<string>>().toEqualTypeOf<
  CoreSelectorOptions<string>
>();

export const useContracts = () => {
  const status: ComputedRef<"unknown" | "none" | "available" | "inconclusive"> =
    useRoute("web", ({ observation }) => observation.status);

  const checking: ComputedRef<boolean> = useRoute(
    "web",
    ({ check }) => check.state === "checking",
  );

  useRunning(({ web }) => web.state);
  useBeaconStatus(({ state }) => state);

  expectTypeOf(useBeacon().value.route("web").state.get()).toEqualTypeOf<
    ReturnType<typeof useRoute<"web">>["value"]
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
  useBeacon().value.route("elsewhere");

  // @ts-expect-error -- what a composable returns is read-only.
  checking.value = true;

  // @ts-expect-error -- so is the provider's Beacon.
  useBeacon().value = beacon;

  useObservable(useBeacon().value.route("web").native);

  return { status, checking };
};
