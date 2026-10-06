import { Beacon } from "@priemskiyyy/beacon";
import type { NoneDecision, ObservableValue, ReleaseIdentity, ReleaseScope, TargetDecision } from "@priemskiyyy/beacon";
export declare const SCOPE: ReleaseScope;
export declare const buildIdentity: (value: string) => ReleaseIdentity;
export declare const target: (value: string) => TargetDecision;
export declare const createWebBeacon: () => {
    beacon: Beacon<{
        web: import("@priemskiyyy/beacon").FeedRoute<{
            web: TargetDecision | NoneDecision;
        }, import("@priemskiyyy/beacon").Release<null>, {}, {
            prefetch: {
                reference: "none";
                impacts: "document-replacement"[];
                binding: "provider-current";
                run: () => Promise<{
                    status: "accepted";
                    receipt: {
                        kind: string;
                    };
                }>;
            };
        }>;
    }>;
    mock: import("@priemskiyyy/beacon/mock").MockSource<{
        web: TargetDecision | NoneDecision;
    }>;
};
export type WebBeacon = ReturnType<typeof createWebBeacon>["beacon"];
export declare const settle: () => Promise<void>;
export declare const countListeners: <TValue>(value: ObservableValue<TValue>) => {
    observable: ObservableValue<TValue>;
    listeners: () => number;
};
