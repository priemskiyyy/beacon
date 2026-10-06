import type { ComponentProps } from "svelte";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { RegisteredBeacon } from "../types/Register.js";
import ViewHarness from "./ViewHarness.fixture.svelte";
type MountedView<TValue> = {
    value: ReadableValue<TValue>;
    container: HTMLElement;
    unmount: () => void;
    rerender: (props: Partial<ComponentProps<typeof ViewHarness>>) => Promise<void>;
};
export declare const mountView: <TValue>(beacon: RegisteredBeacon, use: () => ReadableValue<TValue>, { start }?: {
    start?: boolean;
}) => MountedView<TValue>;
export {};
