import type { CommandRunContext } from "src/types/CommandRunContext";
import type { DriverEmitter } from "src/types/DriverEmitter";
import type { ProviderResult } from "src/types/ProviderResult";
import type { RouteBody } from "src/types/RouteBody";
import { createRoutedBeacon } from "src/utils/Beacon.fixture";
import { createReleaseDriver } from "src/utils/createReleaseDriver";

export const BODY: RouteBody = {
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "android-version-code",
      value: "120",
    },
  },
};

type Receipt = { kind: "done" };

type Context = CommandRunContext<object, Record<never, never>>;

const DONE: ProviderResult<Receipt> = {
  status: "accepted",
  receipt: { kind: "done" },
};

// A provider route with one command of each reference kind, which writes what it was handed into `seen`.
const createReferenceDriver = (name: string) => {
  const seen: Array<{ command: string; given: object | null | undefined }> = [];
  const emitters: Array<DriverEmitter<RouteBody, RouteBody>> = [];

  const route = createReleaseDriver<
    object,
    RouteBody,
    RouteBody,
    {
      download: {
        reference: "offer";
        impacts: [];
        binding: "provider-current";
        run(
          context: Context & { offer: RouteBody },
        ): Promise<ProviderResult<Receipt>>;
      };
      activate: {
        reference: "prepared";
        impacts: [];
        binding: "provider-current";
        run(
          context: Context & { prepared: RouteBody },
        ): Promise<ProviderResult<Receipt>>;
      };
      snooze: {
        reference: "optional-offer";
        impacts: [];
        binding: "provider-current";
        run(
          context: Context & { offer: RouteBody | null },
        ): Promise<ProviderResult<Receipt>>;
      };
      ping: {
        reference: "none";
        impacts: [];
        binding: "provider-current";
        run(context: Context): Promise<ProviderResult<Receipt>>;
      };
    }
  >({
    name,
    subject: "bundle",
    prepares: true,
    open: ({ emit }) => {
      emitters.push(emit);

      return {
        native: {},
        check: async () => ({ status: "available", offer: BODY }),
      };
    },
    commands: {
      download: {
        reference: "offer",
        impacts: [],
        binding: "provider-current",
        run: async ({ offer }) => {
          seen.push({ command: "download", given: offer });

          return DONE;
        },
      },
      activate: {
        reference: "prepared",
        impacts: [],
        binding: "provider-current",
        run: async ({ prepared }) => {
          seen.push({ command: "activate", given: prepared });

          return DONE;
        },
      },
      snooze: {
        reference: "optional-offer",
        impacts: [],
        binding: "provider-current",
        run: async ({ offer }) => {
          seen.push({ command: "snooze", given: offer });

          return DONE;
        },
      },
      ping: {
        reference: "none",
        impacts: [],
        binding: "provider-current",
        run: async () => {
          seen.push({ command: "ping", given: undefined });

          return DONE;
        },
      },
    },
  });

  return { route, seen, emitter: () => emitters.at(-1) };
};

// Two provider routes, each with a command of each reference kind, started and checked, so that each has an offer.
export const createReferenceBeacon = async () => {
  const first = createReferenceDriver("first");
  const second = createReferenceDriver("second");

  const context = createRoutedBeacon({
    first: first.route,
    second: second.route,
  });

  context.beacon.start();
  await context.beacon.check();

  return { ...context, drivers: { first, second } };
};
