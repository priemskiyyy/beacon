// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that a driver's session is not checked again at runtime.
import { expectTypeOf } from "vitest";

import type { DriverContext } from "src/types/DriverContext";
import type { Observation } from "src/types/Observation";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { PreparedState } from "src/types/PreparedState";
import type { RouteBody } from "src/types/RouteBody";
import type { RouteHandle } from "src/types/RouteHandle";
import type { RunningReader } from "src/types/RunningReader";
import { createReleaseDriver } from "src/utils/createReleaseDriver";

type Native = { start: () => void };

type PlayOffer = RouteBody & { flows: Array<"flexible" | "immediate"> };

type UpdateBody = RouteBody & { size: number };

declare const native: Native;

const check = async (): Promise<ObservationDraft<PlayOffer>> => ({
  status: "none",
  reason: "no-decision",
  detail: null,
});

export const play = createReleaseDriver<
  Native,
  PlayOffer,
  UpdateBody,
  Record<never, never>
>({
  name: "play",
  subject: "native",
  prepares: true,
  open: () => ({ native, check }),
  commands: {},
});

declare const handle: RouteHandle<"play", typeof play>;

// The snapshot of a driver route carries the offer and the prepared target the driver declares.
expectTypeOf(handle.state.get().observation).toEqualTypeOf<
  Observation<"play", PlayOffer>
>();

expectTypeOf(handle.state.get().prepared).toEqualTypeOf<
  PreparedState<"play", UpdateBody>
>();

expectTypeOf(handle.native.get()).toEqualTypeOf<Native | null>();

createReleaseDriver({
  name: "hollow",
  subject: "native",
  prepares: false,
  // @ts-expect-error A native handle is an object: null already means the route is not open.
  open: () => ({ native: null, check }),
  commands: {},
});

// A driver compares nothing with what runs, so the reasons of Beacon's own selection are not its to give.
export const ranked: ObservationDraft<RouteBody> = {
  status: "none",
  // @ts-expect-error A driver's `none` is always `no-decision`.
  reason: "older-than-current",
  detail: null,
};

export const unchecked: ObservationDraft<RouteBody> = {
  status: "unknown",
  // @ts-expect-error `not-checked` is Beacon's own first state, never a provider's answer.
  reason: "not-checked",
};

declare const context: DriverContext<PlayOffer, UpdateBody>;

// A driver reads what runs through a view that has no way to write it.
// @ts-expect-error A driver cannot write running facts.
context.running.set({ ...context.running.get(), revision: 0 });

// @ts-expect-error A driver reports a fraction or null, not a label.
context.emit.progress("half");

declare const nativeReader: RunningReader<"native">;

// A driver offers the local reader of its own subject, which the application's own reader replaces.
export const reading = createReleaseDriver({
  name: "reading",
  subject: "native",
  prepares: false,
  running: nativeReader,
  open: () => ({ native, check }),
  commands: {},
});

createReleaseDriver({
  name: "unreading",
  subject: "native",
  prepares: false,
  // @ts-expect-error A reader is a function of the scope of the read, and never a value.
  running: "a91b44e",
  open: () => ({ native, check }),
  commands: {},
});
