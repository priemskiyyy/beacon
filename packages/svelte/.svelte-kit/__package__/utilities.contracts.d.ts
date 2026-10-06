import type { ReadableValue } from "./types/ReadableValue.js";
export declare const useContracts: () => {
    status: ReadableValue<"none" | "inconclusive" | "unknown" | "available">;
    checking: ReadableValue<boolean>;
};
