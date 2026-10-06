import { Beacon, createUpdateMechanism, targetRoute, } from "@priemskiyyy/beacon";
import { createMockSource, createTestClock } from "@priemskiyyy/beacon/mock";
export const SCOPE = {
    application: "com.example.notes",
    environment: "production",
    platform: "web",
    distribution: "public-web",
};
export const buildIdentity = (value) => ({
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value,
});
export const target = (value) => ({
    kind: "target",
    release: { identity: buildIdentity(value), label: `Build ${value}` },
});
// A web route over one mock manifest, with build B running and an inert mechanism.
export const createWebBeacon = () => {
    const mock = createMockSource({
        name: "manifest",
    });
    const web = targetRoute({
        subject: "web",
        source: mock.source.select((manifest) => manifest.web),
        mechanism: createUpdateMechanism({
            name: "inert",
            open: () => ({ native: {} }),
            commands: {
                prefetch: {
                    reference: "none",
                    impacts: ["document-replacement"],
                    binding: "provider-current",
                    run: async () => ({
                        status: "accepted",
                        receipt: { kind: "prefetched" },
                    }),
                },
            },
        }),
    });
    const beacon = new Beacon({
        scope: SCOPE,
        running: {
            boot: { id: "boot-1" },
            web: () => ({
                identity: buildIdentity("web-build-b"),
                label: "Build web-build-b",
                raw: {},
            }),
        },
        routes: { web },
        clock: createTestClock({ now: 1_000 }),
    });
    return { beacon, mock };
};
// Lets every queued promise continuation run before the test goes on.
export const settle = () => new Promise((resolve) => {
    setTimeout(resolve, 0);
});
// A copy of an observable that counts its live listeners, which is what a leak looks like.
export const countListeners = (value) => {
    const counts = { live: 0 };
    const observable = {
        get: value.get,
        getInitial: value.getInitial,
        subscribe: (listener) => {
            counts.live += 1;
            const unsubscribe = value.subscribe(listener);
            return () => {
                counts.live -= 1;
                unsubscribe();
            };
        },
    };
    return { observable, listeners: () => counts.live };
};
