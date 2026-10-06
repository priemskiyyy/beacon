import type { ReadableValue } from "../types/ReadableValue.js";
export declare const mountBareView: <TValue>(use: () => ReadableValue<TValue>) => {
    value: ReadableValue<TValue>;
    unmount: () => void;
};
