// Typechecked, never run: the real `AppState` of React Native, the real NetInfo
// and the real Pulse satisfy the structural types the triggers take, so the
// package imports none of them at runtime, and a source that does not fit, or
// an option that cannot work, does not compile.
import NetInfo from "@react-native-community/netinfo";
import * as NetInfoModule from "@react-native-community/netinfo";
import type { Pulse } from "@priemskiyyy/pulse";
import type { Beacon } from "@priemskiyyy/beacon";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { expectTypeOf } from "vitest";

import { checkOn } from "src/checkOn";
import { foreground } from "src/foreground";
import { interval } from "src/interval";
import { invalidation } from "src/invalidation";
import { pulseForeground } from "src/pulseForeground";
import { reachReconnect } from "src/reachReconnect";
import { reconnect } from "src/reconnect";
import { startup } from "src/startup";
import type { AppStateLike } from "src/types/AppStateLike";
import type { BeaconTrigger } from "src/types/BeaconTrigger";
import type { ConditionLike } from "src/types/ConditionLike";
import type { ForegroundSourceLike } from "src/types/ForegroundSourceLike";
import type { NetInfoLike } from "src/types/NetInfoLike";
import type { Subscribable } from "src/types/Subscribable";

// A declaration that did not resolve would be `any` and satisfy everything.
type IsAny<TValue> = 0 extends 1 & TValue ? true : false;

declare const beacon: Beacon;

declare const pulse: Pulse;

expectTypeOf<IsAny<typeof AppState>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<typeof NetInfo>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<typeof NetInfoModule>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<Pulse>>().toEqualTypeOf<false>();

// React Native's `AppState`.
expectTypeOf(AppState.currentState).toEqualTypeOf<AppStateStatus>();
expectTypeOf(AppState).toExtend<AppStateLike>();

// NetInfo, as the default export and as the module's own functions.
expectTypeOf(NetInfo).toExtend<NetInfoLike>();
expectTypeOf(NetInfoModule).toExtend<NetInfoLike>();

// Pulse says a return and a departure, and its state is something to subscribe to.
expectTypeOf(pulse).toExtend<ForegroundSourceLike>();
expectTypeOf(pulse.state).toExtend<Subscribable>();

// A Beacon's own observables are something to subscribe to, too.
expectTypeOf(beacon.running).toExtend<Subscribable>();

export const stop = checkOn(beacon, {
  triggers: [
    startup(),
    foreground({ appState: AppState, minAway: 30_000 }),
    reconnect({ netInfo: NetInfo }),
    interval({ every: 30 * 60_000, jitter: 0.2 }),
  ],
  minInterval: 10_000,
  backoff: { first: 10_000, max: 15 * 60_000, jitter: 0.2, attempts: 3 },
  whileFresh: "skip",
  onExpiry: true,
  random: Math.random,
});

expectTypeOf(stop).toEqualTypeOf<() => void>();

export const web = checkOn(beacon, {
  triggers: [
    pulseForeground({ source: pulse, minAway: 30_000 }),
    invalidation({ source: pulse.state }),
  ],
  backoff: false,
});

declare const condition: ConditionLike;

export const condtionTrigger = reachReconnect({ condition });

// @ts-expect-error -- `AppState` has two members the trigger listens through.
foreground({ appState: { currentState: "active" } });

// @ts-expect-error -- NetInfo is not `AppState`: nothing here would tell it a listener.
reconnect({ netInfo: AppState });

// @ts-expect-error -- a Pulse has no `addEventListener`: it has its own trigger.
foreground({ appState: pulse });

// @ts-expect-error -- `AppState` has no `on`: its own trigger is `foreground`.
pulseForeground({ source: AppState });

export const wrongEvent: ForegroundSourceLike = {
  // @ts-expect-error -- a source whose event has no `observedAway` cannot say how long the app was away.
  on: (
    type: "foreground" | "background",
    listener: (event: { other: number }) => void,
  ) => {
    listener({ other: type.length });

    return () => {};
  },
};

// @ts-expect-error -- the wait after a failure needs its longest wait.
checkOn(beacon, { triggers: [], backoff: { first: 10_000 } });

// @ts-expect-error -- a fresh answer is checked or skipped, and nothing else.
checkOn(beacon, { triggers: [], whileFresh: "sometimes" });

// @ts-expect-error -- the Beacon's own clock is the only one: there is no `clock` option.
checkOn(beacon, { triggers: [], clock: beacon.clock });

// @ts-expect-error -- the interval needs a delay in milliseconds, not a text.
interval({ every: "60000" });

// @ts-expect-error -- the triggers are required: a gate with none checks nothing.
checkOn(beacon, {});

export const custom: BeaconTrigger = (target) => {
  // @ts-expect-error -- the reasons are the core's: there is no `expiry` or `retry` label.
  target.signal("expiry");

  return () => {};
};
