import { flushSync, hydrate, unmount } from "svelte";
import { afterEach, expect, test, vi } from "vitest";
import { createWebBeacon, settle } from "../beacon.fixture.js";
import { STATUS_MARKUP } from "./serverMarkup.fixture.js";
import StatusHarness from "./StatusHarness.fixture.svelte";
afterEach(() => {
    document.body.replaceChildren();
});
const mountServerMarkup = () => {
    const target = document.body.appendChild(document.createElement("div"));
    target.innerHTML = STATUS_MARKUP;
    return target;
};
test("BIND-08 hydrating the server markup does not mismatch, and the session starts after hydration", () => {
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    const { beacon } = createWebBeacon();
    const seen = [];
    const target = mountServerMarkup();
    const app = hydrate(StatusHarness, { target, props: { beacon, seen } });
    expect(beacon.status.get()).toEqual({ state: "idle" });
    flushSync();
    expect(warn.mock.calls).toEqual([]);
    expect(error.mock.calls).toEqual([]);
    expect(seen).toEqual(["unknown/pending"]);
    expect(beacon.status.get()).toMatchObject({ state: "running" });
    unmount(app);
});
test("BIND-08 a boundary that hydrates after the session started still matches the server markup", async () => {
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    const { beacon } = createWebBeacon();
    const seen = [];
    const target = mountServerMarkup();
    // What runs is known before the boundary hydrates, so the live state differs from the markup.
    beacon.start();
    await settle();
    expect(beacon.running.get().web.state).toBe("known");
    const app = hydrate(StatusHarness, { target, props: { beacon, seen } });
    flushSync();
    expect(warn.mock.calls).toEqual([]);
    expect(error.mock.calls).toEqual([]);
    // Hydration read the markup's value, and the render after it read the live one.
    expect(seen).toEqual(["unknown/pending"]);
    expect(target.textContent).toBe("unknown/known");
    unmount(app);
});
