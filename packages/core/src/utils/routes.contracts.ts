// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that Beacon does not check it again at runtime.
import { expectTypeOf } from "vitest";

import type { CandidateDecision } from "src/types/CandidateDecision";
import type { NoneDecision } from "src/types/NoneDecision";
import type { Observation } from "src/types/Observation";
import type { OfferReference } from "src/types/OfferReference";
import type { PreparedReference } from "src/types/PreparedReference";
import type { Release } from "src/types/Release";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RouteHandle } from "src/types/RouteHandle";
import type { ScopeReplacement } from "src/types/ScopeReplacement";
import type { TargetDecision } from "src/types/TargetDecision";
import type { Beacon } from "src/utils/Beacon";
import { createReleaseDriver } from "src/utils/createReleaseDriver";
import { createReleaseSource } from "src/utils/createReleaseSource";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { newerRoute } from "src/utils/newerRoute";
import { targetRoute } from "src/utils/targetRoute";
import { custom } from "src/utils/versions/custom";
import { integer } from "src/utils/versions/integer";
import { semver } from "src/utils/versions/semver";
import type { ProviderResult } from "src/types/ProviderResult";
import type { CommandRunContext } from "src/types/CommandRunContext";
import type { RouteBody } from "src/types/RouteBody";

type Browser = { reload: () => void };

type ReloadReceipt = { kind: "reload-requested" };

type FlowReceipt = { kind: "flow-started"; flow: "flexible" | "immediate" };

type Manifest = {
  web: TargetDecision | NoneDecision;
  binary: CandidateDecision<string> | NoneDecision;
  build: CandidateDecision<number> | NoneDecision;
};

declare const browser: Browser;

const manifest = createReleaseSource<Manifest>({
  name: "manifest",
  read: async () => {
    throw new Error("Never run.");
  },
});

const browserReload = createUpdateMechanism({
  name: "browser-reload",
  open: () => ({ native: browser }),
  commands: {
    requestReload: {
      reference: "offer",
      impacts: ["document-replacement"],
      binding: "unpinned-navigation",
      run: async (context): Promise<ProviderResult<ReloadReceipt>> => {
        context.native.reload();

        return { status: "accepted", receipt: { kind: "reload-requested" } };
      },
    },
  },
});

const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.web),
  mechanism: browserReload,
});

const binary = newerRoute({
  subject: "native",
  source: manifest.select((document) => document.binary),
  version: semver(),
  current: (release) => release?.label ?? null,
  mechanism: browserReload,
});

targetRoute({
  subject: "web",
  // @ts-expect-error A target route reads target decisions, not candidates.
  source: manifest.select((document) => document.binary),
  mechanism: browserReload,
});

newerRoute({
  subject: "native",
  // @ts-expect-error A newer route reads candidate decisions, not targets.
  source: manifest.select((document) => document.web),
  version: semver(),
  current: () => "1.0.0",
  mechanism: browserReload,
});

newerRoute({
  subject: "native",
  // @ts-expect-error The strategy parses strings but the candidate order is a number.
  source: manifest.select((document) => document.build),
  version: semver(),
  // @ts-expect-error The current order must be the strategy's input type too.
  current: () => 1,
  mechanism: browserReload,
});

newerRoute({
  subject: "native",
  source: manifest.select((document) => document.build),
  version: integer(),
  // @ts-expect-error The current order must be the strategy's input type.
  current: () => ({ train: "stable" }),
  mechanism: browserReload,
});

export const routes = { web, binary } satisfies Record<string, RouteDefinition>;

type WebHandle = RouteHandle<"web", typeof web>;

declare const webHandle: WebHandle;

declare const webOffer: OfferReference<"web">;

declare const otherOffer: OfferReference<"binary">;

declare const webPrepared: PreparedReference<"web">;

export const outcome = webHandle.requestReload({ offer: webOffer });

expectTypeOf(webHandle.native.get()).toEqualTypeOf<Browser | null>();

expectTypeOf(
  webHandle.capabilities.requestReload.reference,
).toEqualTypeOf<"offer">();

expectTypeOf(webHandle.state.get().observation).toEqualTypeOf<
  Observation<"web", { release: Release<null> }>
>();

// @ts-expect-error A reload needs the offer reference.
webHandle.requestReload({});

// @ts-expect-error A reload needs an argument.
webHandle.requestReload();

// BIND-03 A reference of another route or another kind does not compile.
// @ts-expect-error An offer of another route is refused at compile time.
webHandle.requestReload({ offer: otherOffer });

// @ts-expect-error A prepared reference is not an offer reference.
webHandle.requestReload({ offer: webPrepared });

// BIND-02 A route without a command has no method for it in its inferred type.
// @ts-expect-error There is no universal install.
webHandle.install({ offer: webOffer });

const settled = await webHandle.requestReload({ offer: webOffer });

// @ts-expect-error A reload outcome has no updated flag.
export const updated = settled.updated;

const playNative = { start: (flow: "flexible" | "immediate") => flow };

type PlayOffer = RouteBody & { flows: Array<"flexible" | "immediate"> };

type PlayNative = typeof playNative;

export const play = createReleaseDriver<
  PlayNative,
  PlayOffer,
  RouteBody,
  {
    startUpdate: {
      reference: "offer";
      impacts: ["native-update-flow"];
      binding: "provider-current";
      run(
        context: CommandRunContext<
          PlayNative,
          { flow: "flexible" | "immediate" }
        > & { offer: PlayOffer },
      ): Promise<ProviderResult<FlowReceipt>>;
    };
  }
>({
  name: "google-play",
  subject: "native",
  prepares: true,
  open: () => ({
    native: playNative,
    check: async () => ({
      status: "none",
      reason: "no-decision",
      detail: null,
    }),
  }),
  commands: {
    startUpdate: {
      reference: "offer",
      impacts: ["native-update-flow"],
      binding: "provider-current",
      run: async ({ native, parameters }) => {
        native.start(parameters.flow);

        return {
          status: "accepted",
          receipt: { kind: "flow-started", flow: parameters.flow },
        };
      },
    },
  },
});

export const driverRoutes = { play } satisfies Record<string, RouteDefinition>;

declare const playHandle: RouteHandle<"binary", typeof play>;

declare const playOffer: OfferReference<"binary">;

export const started = playHandle.startUpdate({
  offer: playOffer,
  flow: "flexible",
  signal: new AbortController().signal,
});

// @ts-expect-error The flow is a required parameter of the command.
playHandle.startUpdate({ offer: playOffer });

// @ts-expect-error The flow must be one the command declares.
playHandle.startUpdate({ offer: playOffer, flow: "background" });

export const orderStrategy = custom({
  name: "trains",
  parse: (input: string) => input,
  compare: () => "equal",
});

createUpdateMechanism({
  name: "reserved",
  open: () => ({ native: browser }),
  commands: {
    hijack: {
      reference: "none",
      impacts: [],
      binding: "provider-current",
      // @ts-expect-error A command cannot declare a parameter named after a Beacon key.
      run: async (context: {
        native: Browser;
        signal: AbortSignal;
        parameters: { signal: string };
      }): Promise<ProviderResult<ReloadReceipt>> => {
        context.parameters.signal.trim();

        return { status: "accepted", receipt: { kind: "reload-requested" } };
      },
    },
  },
});

createUpdateMechanism({
  name: "colliding",
  open: () => ({ native: browser }),
  commands: {
    // @ts-expect-error A command cannot take the name of a member every route handle has.
    check: {
      reference: "none",
      impacts: [],
      binding: "provider-current",
      run: async (): Promise<ProviderResult<ReloadReceipt>> => ({
        status: "accepted",
        receipt: { kind: "reload-requested" },
      }),
    },
  },
});

createUpdateMechanism({
  name: "hollow",
  // @ts-expect-error A native handle is an object: null already means the route is not open.
  open: () => ({ native: null }),
  commands: {},
});

declare const beacon: Beacon<{ web: typeof web }>;

// BIND-01 A route name that was never defined does not compile.
// @ts-expect-error A route name that was never defined does not compile.
beacon.route("nope");

// @ts-expect-error A scope names all four of its fields.
beacon.replaceScope({ application: "com.example.notes" });

expectTypeOf(beacon.replaceScope).returns.toEqualTypeOf<ScopeReplacement>();

export const trains = custom({
  name: "trains",
  parse: (input: string) => ({ train: 1, sequence: Number(input) }),
  compare: (candidate, current) => {
    // BIND-04 The comparator receives the domain its parser returns, not a type of the caller's choosing.
    expectTypeOf(candidate).toEqualTypeOf<{
      train: number;
      sequence: number;
    }>();
    expectTypeOf(current).toEqualTypeOf<{ train: number; sequence: number }>();

    return "equal";
  },
});
