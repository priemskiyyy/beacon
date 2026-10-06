// Typechecked, never run: the real DOM window satisfies the structural types
// the browser triggers take, so the package reads nothing from a window until a
// session opens, and a target that does not fit, or an option of the React
// Native triggers, does not compile.
import type { Beacon } from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import { foreground } from "src/browser/foreground";
import { reconnect } from "src/browser/reconnect";
import type { ForegroundWindowLike } from "src/browser/types/ForegroundWindowLike";
import type { ReconnectWindowLike } from "src/browser/types/ReconnectWindowLike";
import { checkOn } from "src/checkOn";
import type { BeaconTrigger } from "src/types/BeaconTrigger";

declare const beacon: Beacon;

// The window of a browser, and the window of another frame, are what the triggers listen to.
expectTypeOf(window).toExtend<ForegroundWindowLike>();
expectTypeOf(window).toExtend<ReconnectWindowLike>();

export const returns = foreground({ target: window, minAway: 30_000 });
export const back = reconnect({ target: window });

// Both are triggers of the same kind as the React Native ones, and need no option at all.
expectTypeOf(foreground()).toEqualTypeOf<BeaconTrigger>();
expectTypeOf(reconnect()).toEqualTypeOf<BeaconTrigger>();

export const stop = checkOn(beacon, { triggers: [foreground(), reconnect()] });

expectTypeOf(stop).toEqualTypeOf<() => void>();

// @ts-expect-error -- a window of another kind has no document to be visible or hidden.
foreground({ target: { addEventListener: () => {} } });

// @ts-expect-error -- a target that listens to nothing cannot be told the network came back.
reconnect({ target: {} });

// @ts-expect-error -- a web page has no AppState: the React Native trigger takes one, and this one takes a window.
foreground({ appState: { currentState: "active" } });

// @ts-expect-error -- minAway is milliseconds.
foreground({ minAway: "30s" });
