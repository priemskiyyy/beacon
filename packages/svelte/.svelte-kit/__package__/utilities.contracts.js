import { expectTypeOf } from "vitest";
import { useBeacon } from "./utilities/useBeacon.js";
import { useObservable } from "./utilities/useObservable.js";
import { useRoute } from "./utilities/useRoute.js";
import { useRunning } from "./utilities/useRunning.js";
import { useStatus } from "./utilities/useStatus.js";
expectTypeOf().toEqualTypeOf();
expectTypeOf().toEqualTypeOf();
export const useContracts = () => {
    const status = useRoute("web", ({ observation }) => observation.status);
    const checking = useRoute("web", ({ check }) => check.state === "checking");
    useRunning(({ web }) => web.state);
    useStatus(({ state }) => state);
    expectTypeOf(useBeacon().current).toEqualTypeOf();
    expectTypeOf(useBeacon().current.route("web").state.get()).toEqualTypeOf();
    useRoute("web", ({ check }) => check.state, {
        // @ts-expect-error -- equality compares the selected type, nothing else.
        isEqual: (previous, next) => previous === next,
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
