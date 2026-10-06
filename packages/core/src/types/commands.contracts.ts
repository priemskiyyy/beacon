// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that a command's declaration is not checked again at runtime.
import { expectTypeOf } from "vitest";

import type { CommandArguments } from "src/types/CommandArguments";
import type { CommandDescriptor } from "src/types/CommandDescriptor";
import type { CommandMap } from "src/types/CommandMap";
import type { CommandOutcome } from "src/types/CommandOutcome";
import type { CommandParameters } from "src/types/CommandParameters";
import type { CommandRunContext } from "src/types/CommandRunContext";
import type { DriverRoute } from "src/types/DriverRoute";
import type { Offer } from "src/types/Offer";
import type { OfferReference } from "src/types/OfferReference";
import type { Prepared } from "src/types/Prepared";
import type { PreparedReference } from "src/types/PreparedReference";
import type { ProviderResult } from "src/types/ProviderResult";
import type { RouteBody } from "src/types/RouteBody";
import type { RouteHandle } from "src/types/RouteHandle";
import { createReleaseDriver } from "src/utils/createReleaseDriver";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";

type Native = { start: () => void };

type Receipt = { kind: "started" };

type Steps = { steps: number };

declare const native: Native;

const STARTED: ProviderResult<Receipt> = {
  status: "accepted",
  receipt: { kind: "started" },
};

// A command that declares nothing beyond what every command must.
const inert: CommandDescriptor<
  Native,
  RouteBody,
  RouteBody,
  Record<never, never>,
  Receipt
> = {
  reference: "none",
  impacts: [],
  binding: "provider-current",
  run: async () => STARTED,
};

const commands = {
  download: {
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "provider-current",
    run: async () => STARTED,
  },
  restart: {
    reference: "prepared",
    impacts: ["javascript-restart"],
    binding: "exact-instance",
    run: async () => STARTED,
  },
  warm: {
    reference: "optional-offer",
    impacts: [],
    binding: "provider-current",
    run: async () => STARTED,
  },
  refresh: {
    reference: "none",
    impacts: [],
    binding: "provider-current",
    run: async () => STARTED,
  },
  advance: {
    reference: "none",
    impacts: [],
    binding: "provider-current",
    run: async ({ parameters }: CommandRunContext<Native, Steps>) => {
      expectTypeOf(parameters).toEqualTypeOf<Steps>();

      return STARTED;
    },
  },
} satisfies CommandMap<Native, RouteBody, RouteBody>;

export const ota = createReleaseDriver({
  name: "ota",
  subject: "bundle",
  prepares: true,
  open: () => ({
    native,
    check: async () => ({
      status: "none",
      reason: "no-decision",
      detail: null,
    }),
  }),
  commands,
});

declare const handle: RouteHandle<"ota", typeof ota>;

declare const offer: OfferReference<"ota">;

declare const prepared: PreparedReference<"ota">;

declare const foreignPrepared: PreparedReference<"elsewhere">;

declare const signal: AbortSignal;

// A command that needs an offer takes an offer reference, and only that one.
export const downloaded = handle.download({ offer, signal });

// @ts-expect-error A prepared reference is not an offer reference.
handle.download({ offer: prepared });

// A command that needs an offer also takes the offer itself, and only one of its own route.
declare const offered: Offer<"ota", RouteBody>;

declare const offeredElsewhere: Offer<"elsewhere", RouteBody>;

declare const preparedTarget: Prepared<"ota", RouteBody>;

export const downloadedOffer = handle.download({ offer: offered });

// @ts-expect-error An offer of another route does not fit.
handle.download({ offer: offeredElsewhere });

// @ts-expect-error A prepared target is not an offer.
handle.download({ offer: preparedTarget });

// A command that needs a prepared target takes a prepared reference, or the prepared target itself.
export const restarted = handle.restart({ prepared });

export const restartedTarget = handle.restart({ prepared: preparedTarget });

// @ts-expect-error An offer is not a prepared target.
handle.restart({ prepared: offered });

// @ts-expect-error An offer reference is not a prepared reference.
handle.restart({ prepared: offer });

// @ts-expect-error A prepared reference of another route does not fit.
handle.restart({ prepared: foreignPrepared });

// @ts-expect-error A restart needs the prepared reference.
handle.restart({});

// @ts-expect-error A restart needs an argument.
handle.restart();

// An optional offer may be left out, and when it is given it is an offer reference or the offer.
export const warmed = [
  handle.warm(),
  handle.warm({}),
  handle.warm({ offer }),
  handle.warm({ offer: offered }),
];

// @ts-expect-error A prepared reference is not an offer reference.
handle.warm({ offer: prepared });

// A command that needs no reference takes none, and its own parameters when it declares them.
export const refreshed = [handle.refresh(), handle.refresh({ signal })];

export const advanced = handle.advance({ steps: 2 });

// @ts-expect-error A parameter the command declares is required.
handle.advance();

// @ts-expect-error A parameter is of the type the command declares.
handle.advance({ steps: "two" });

// @ts-expect-error A command takes only the parameters it declares.
handle.refresh({ steps: 2 });

// The receipt is what the command declares, and an accepted one carries the operation.
expectTypeOf(await handle.download({ offer })).toEqualTypeOf<
  CommandOutcome<Receipt>
>();

expectTypeOf<
  Extract<CommandOutcome<Receipt>, { status: "accepted" }>
>().toEqualTypeOf<{
  status: "accepted";
  operation: { id: number };
  receipt: Receipt;
}>();

expectTypeOf(handle.capabilities.restart.reference).toEqualTypeOf<"prepared">();

expectTypeOf(
  handle.capabilities.warm.reference,
).toEqualTypeOf<"optional-offer">();

// A receipt names what was accepted, so it has a kind and is never a bare flag.
// @ts-expect-error A receipt without a kind does not name anything.
export type Bare = ProviderResult<{ updated: true }>;

createUpdateMechanism({
  name: "mistyped",
  subject: "web",
  open: () => ({ native }),
  commands: {
    first: {
      // @ts-expect-error A command declares one of four references.
      reference: "everything",
      impacts: [],
      binding: "provider-current",
      run: async () => STARTED,
    },
    second: {
      reference: "none",
      impacts: [],
      // @ts-expect-error A command declares one of four bindings.
      binding: "loose",
      run: async () => STARTED,
    },
    third: {
      reference: "none",
      // @ts-expect-error A command declares only impacts Beacon knows.
      impacts: ["explode"],
      binding: "provider-current",
      run: async () => STARTED,
    },
  },
});

createUpdateMechanism({
  name: "colliding",
  subject: "web",
  open: () => ({ native }),
  commands: {
    // @ts-expect-error A command cannot take the name of a member every route handle has: state.
    state: inert,
    // @ts-expect-error A command cannot take the name of a member every route handle has: native.
    native: inert,
    // @ts-expect-error A command cannot take the name of a member every route handle has: capabilities.
    capabilities: inert,
    // @ts-expect-error A command cannot take the name of a member every route handle has: acknowledge.
    acknowledge: inert,
    // Any other name is free, so the four above are refused for their names alone.
    restate: inert,
  },
});

// The names above are not a list kept in step by hand: whatever a route handle has beside its commands is refused as a command name.
type HandleOfNoCommands = RouteHandle<
  "bare",
  DriverRoute<Native, RouteBody, RouteBody, Record<never, never>>
>;

expectTypeOf<
  CommandMap<Native, RouteBody, RouteBody>[keyof HandleOfNoCommands]
>().toEqualTypeOf<undefined>();

// Whatever a call carries for Beacon's own use is refused as a parameter name.
type CallKeys =
  | keyof NonNullable<CommandArguments<"r", "offer", Record<never, never>>[0]>
  | keyof NonNullable<
      CommandArguments<"r", "prepared", Record<never, never>>[0]
    >
  | keyof NonNullable<
      CommandArguments<"r", "optional-offer", Record<never, never>>[0]
    >;

expectTypeOf<keyof CommandParameters>().toEqualTypeOf<CallKeys>();

createUpdateMechanism({
  name: "reserved",
  subject: "web",
  open: () => ({ native }),
  commands: {
    first: {
      reference: "none",
      impacts: [],
      binding: "provider-current",
      // @ts-expect-error A command cannot declare a parameter named offer, which is Beacon's own key.
      run: async (context: {
        native: Native;
        signal: AbortSignal;
        parameters: { offer: string };
      }): Promise<ProviderResult<Receipt>> => {
        context.parameters.offer.trim();

        return STARTED;
      },
    },
    second: {
      reference: "none",
      impacts: [],
      binding: "provider-current",
      // @ts-expect-error A command cannot declare a parameter named prepared, which is Beacon's own key.
      run: async (context: {
        native: Native;
        signal: AbortSignal;
        parameters: { prepared: string };
      }): Promise<ProviderResult<Receipt>> => {
        context.parameters.prepared.trim();

        return STARTED;
      },
    },
    third: {
      reference: "none",
      impacts: [],
      binding: "provider-current",
      // @ts-expect-error A command cannot declare a parameter named signal, which is Beacon's own key.
      run: async (context: {
        native: Native;
        signal: AbortSignal;
        parameters: { signal: string };
      }): Promise<ProviderResult<Receipt>> => {
        context.parameters.signal.trim();

        return STARTED;
      },
    },
    // Any other name is free, so the three above are refused for their names alone.
    fourth: {
      reference: "none",
      impacts: [],
      binding: "provider-current",
      run: async (context: {
        native: Native;
        signal: AbortSignal;
        parameters: { label: string };
      }): Promise<ProviderResult<Receipt>> => {
        context.parameters.label.trim();

        return STARTED;
      },
    },
  },
});
