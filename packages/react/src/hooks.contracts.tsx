// Typechecked, never run: a selection is inferred from the route's own types,
// equality takes only the selected type, and any Beacon fits the provider.
import {
  Beacon,
  createReleaseSource,
  createUpdateMechanism,
  targetRoute,
} from "@priemskiyyy/beacon";
import type { NoneDecision, TargetDecision } from "@priemskiyyy/beacon";

import { BeaconProvider } from "src/context/BeaconProvider";
import { useRoute } from "src/hooks/useRoute";
import { useRunning } from "src/hooks/useRunning";

const manifest = createReleaseSource<{ web: TargetDecision | NoneDecision }>({
  name: "manifest",
  read: async () => {
    throw new Error("Never run.");
  },
});

const beacon = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
  },
  running: { boot: { id: "boot-1" } },
  routes: {
    web: targetRoute({
      subject: "web",
      source: manifest.select((document) => document.web),
      mechanism: createUpdateMechanism({
        name: "inert",
        open: () => ({ native: {} }),
        commands: {},
      }),
    }),
  },
});

export const provider = <BeaconProvider beacon={beacon} start />;

export const useContracts = () => {
  const status: "unknown" | "none" | "available" | "inconclusive" = useRoute(
    beacon.route("web"),
    ({ observation }) => observation.status,
  );

  const checking: boolean = useRoute(
    beacon.route("web"),
    ({ check }) => check.state === "checking",
  );

  useRunning(beacon, ({ web }) => web.state);

  useRoute(beacon.route("web"), ({ check }) => check.state, {
    // @ts-expect-error -- equality compares the selected type, nothing else.
    isEqual: (previous: number, next: number) => previous === next,
  });

  // @ts-expect-error -- a route is read through its typed handle, never a name.
  useRoute("web");

  // @ts-expect-error -- a selection that reads a missing field fails to compile.
  useRoute(beacon.route("web"), ({ observation }) => observation.missing);

  return { status, checking };
};
