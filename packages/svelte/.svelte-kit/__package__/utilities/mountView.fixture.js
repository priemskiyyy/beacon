import { render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import ViewHarness from "./ViewHarness.fixture.svelte";
// Mounts a component that runs `use` while it initializes, under a provider of the Beacon, and lets its effects run.
export const mountView = (beacon, use, { start } = {}) => {
    const captured = [];
    const { container, unmount, rerender } = render(ViewHarness, {
        props: {
            beacon,
            start,
            read: () => {
                captured.push(use());
            },
        },
    });
    flushSync();
    const [value] = captured;
    if (value === undefined) {
        throw new Error("The view did not run the utility.");
    }
    return { value, container, unmount, rerender };
};
