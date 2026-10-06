import { cleanup, render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, expect, test } from "vitest";
import { createWebBeacon, settle } from "../beacon.fixture.js";
import { useDisruption } from "./useDisruption.svelte.js";
import ViewHarness from "./ViewHarness.fixture.svelte";
afterEach(cleanup);
const draftEditor = (overrides = {}) => ({
    name: "draft-editor",
    impacts: ["document-replacement"],
    reserve: () => ({ status: "reserved", release: () => { } }),
    ...overrides,
});
// Mounts a component that registers the participant, under a provider of the Beacon.
const mountParticipant = (beacon, participant) => {
    const view = render(ViewHarness, {
        props: { beacon, read: () => useDisruption(participant) },
    });
    flushSync();
    return view;
};
// Counts the registrations the Beacon receives, which is what a registration on every change would show.
const countRegistrations = (beacon) => {
    const counts = { registered: 0, unregistered: 0 };
    const { register } = beacon.disruptions;
    beacon.disruptions = {
        register: (participant) => {
            counts.registered += 1;
            const unregister = register(participant);
            return () => {
                counts.unregistered += 1;
                unregister();
            };
        },
    };
    return counts;
};
test("useDisruption registers while mounted and unregisters on unmount", async () => {
    const { beacon } = createWebBeacon();
    const { unmount } = mountParticipant(beacon, draftEditor({
        reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
    }));
    beacon.start();
    await expect(beacon.route("web").prefetch()).resolves.toEqual({
        status: "blocked",
        reasons: [{ code: "unsaved-draft", participant: { name: "draft-editor" } }],
    });
    unmount();
    await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
        status: "accepted",
    });
});
test("useDisruption asks the participant with the state it has when Beacon asks, and registers once", async () => {
    const { beacon } = createWebBeacon();
    const counts = countRegistrations(beacon);
    const asked = { count: 0 };
    let dirty = $state(true);
    let label = $state("draft-editor");
    const { unmount } = mountParticipant(beacon, {
        get name() {
            return label;
        },
        impacts: ["document-replacement"],
        reserve: () => {
            asked.count += 1;
            if (dirty) {
                return { status: "blocked", code: "unsaved-draft" };
            }
            return { status: "reserved", release: () => { } };
        },
    });
    beacon.start();
    await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
        status: "blocked",
        reasons: [{ participant: { name: "draft-editor" } }],
    });
    label = "renamed";
    flushSync();
    await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
        status: "blocked",
        reasons: [{ participant: { name: "renamed" } }],
    });
    dirty = false;
    flushSync();
    await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
        status: "accepted",
    });
    expect(asked.count).toBe(3);
    expect(counts).toEqual({ registered: 1, unregistered: 0 });
    unmount();
    expect(counts).toEqual({ registered: 1, unregistered: 1 });
});
test("useDisruption follows a provider that publishes another Beacon", async () => {
    const first = createWebBeacon();
    const second = createWebBeacon();
    const view = mountParticipant(first.beacon, draftEditor({
        reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
    }));
    first.beacon.start();
    second.beacon.start();
    await view.rerender({ beacon: second.beacon });
    flushSync();
    await expect(first.beacon.route("web").prefetch()).resolves.toMatchObject({
        status: "accepted",
    });
    await expect(second.beacon.route("web").prefetch()).resolves.toMatchObject({
        status: "blocked",
    });
});
test("SAFE-14 a reservation a component held is released when the command ends, not when the component unmounts", async () => {
    const { beacon } = createWebBeacon();
    const released = { count: 0 };
    const settling = { finish: () => { } };
    const { unmount } = mountParticipant(beacon, {
        name: "draft-editor",
        impacts: ["document-replacement"],
        reserve: () => ({
            status: "reserved",
            settle: () => new Promise((resolve) => {
                settling.finish = () => resolve({ status: "ready" });
            }),
            release: () => {
                released.count += 1;
            },
        }),
    });
    beacon.start();
    const command = beacon.route("web").prefetch();
    await settle();
    unmount();
    expect(released.count).toBe(0);
    settling.finish();
    await expect(command).resolves.toMatchObject({ status: "blocked" });
    expect(released.count).toBe(1);
});
