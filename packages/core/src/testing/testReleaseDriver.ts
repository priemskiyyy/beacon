import { describe, expect, test } from "vitest";

import type { CommandMap } from "src/types/CommandMap";
import type { DriverEmitter } from "src/types/DriverEmitter";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { DriverRoute } from "src/types/DriverRoute";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningApplication } from "src/types/RunningApplication";
import { expectValidCommands } from "src/testing/expectValidCommands";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";

/** A driver under test, over a fake provider SDK created for this test alone. */
export type ReleaseDriverFixture<
  TNative extends object,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
> = {
  route: DriverRoute<TNative, TOffer, TPrepared, TCommands>;
  /** The provider's change events. Leave it out when the provider reports no changes. */
  provider?: {
    /** Makes the provider report a change, as its SDK would. */
    update: () => void;
    /** How many change listeners the driver holds on the provider. */
    listeners: () => number;
  };
};

/** What a driver's conformance suite is run over. */
export type ReleaseDriverConformanceOptions<
  TNative extends object,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
> = {
  name: string;
  create: () => ReleaseDriverFixture<TNative, TOffer, TPrepared, TCommands>;
};

const SCOPE: ReleaseScope = {
  application: "com.example.conformance",
  environment: "test",
  platform: "android",
  distribution: "store",
};

const RUNNING: RunningApplication = {
  boot: { id: "conformance-boot" },
  revision: 0,
  native: { state: "unconfigured" },
  bundle: { state: "unconfigured" },
  web: { state: "unconfigured" },
  worker: { state: "unconfigured" },
};

const expectIdentity = (identity: ReleaseIdentity) => {
  if (identity.status === "unknown") {
    expect(identity.reason).not.toBe("");

    return;
  }

  expect(identity.authority).not.toBe("");
  expect(identity.domain).not.toBe("");
  expect(identity.value).not.toBe("");
};

const expectDraft = <TOffer extends RouteBody>(
  draft: ObservationDraft<TOffer>,
) => {
  if (draft.status === "available") {
    expectIdentity(draft.offer.release.identity);

    return;
  }

  if (draft.status === "none") {
    expect(draft.reason).not.toBe("");

    return;
  }

  if (draft.status === "unknown" || draft.status === "inconclusive") {
    expect(draft.reason).not.toBe("");

    return;
  }

  assertUnreachable(draft);
};

// The emitter a driver is opened with, recording what it was told.
const createRecordingEmitter = <
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
>() => {
  const heard = { observations: 0, prepared: 0, progress: 0 };

  const emit: DriverEmitter<TOffer, TPrepared> = {
    observation: (draft) => {
      expectDraft(draft);
      heard.observations += 1;
    },
    prepared: () => {
      heard.prepared += 1;
    },
    progress: (fraction) => {
      if (fraction !== null) {
        expect(fraction).toBeGreaterThanOrEqual(0);
        expect(fraction).toBeLessThanOrEqual(1);
      }

      heard.progress += 1;
    },
  };

  return { emit, heard };
};

const running = {
  get: () => RUNNING,
  subscribe: () => () => {},
};

/**
 * Registers the contract every provider driver keeps: it declares valid
 * commands, it opens a session with a native handle and a check that answers a
 * valid observation, it reports a prepared target only when it declared that it
 * prepares, it holds no listener on the provider once its session is disposed,
 * and it reports nothing after that. Call it at the top level of
 * `src/conformance.test.ts`, over a fake provider SDK.
 *
 * It cannot check that the fake behaves like the real SDK, or that a command
 * does what its receipt claims: keep those in the adapter's own tests, and
 * validate the flow on real devices.
 *
 * @example
 * ```ts
 * testReleaseDriver({
 *   name: "expo-updates",
 *   create: () => {
 *     const fake = fakeUpdates();
 *
 *     return { route: expoUpdates({ updates: fake.updates }) };
 *   },
 * });
 * ```
 */
export const testReleaseDriver = <
  TNative extends object,
  TOffer extends RouteBody,
  TPrepared extends RouteBody,
  TCommands extends CommandMap<TNative, TOffer, TPrepared>,
>({
  name,
  create,
}: ReleaseDriverConformanceOptions<TNative, TOffer, TPrepared, TCommands>) => {
  const open = (
    fixture: ReleaseDriverFixture<TNative, TOffer, TPrepared, TCommands>,
  ) => {
    const recording = createRecordingEmitter<TOffer, TPrepared>();

    const session = fixture.route.driver.open({
      scope: SCOPE,
      running,
      emit: recording.emit,
    });

    return { session, heard: recording.heard };
  };

  describe(`release driver: ${name}`, () => {
    test("it has a name for diagnostics", () => {
      expect(create().route.driver.name).not.toBe("");
    });

    test("every command declares a known reference, binding and impacts", () => {
      expectValidCommands(create().route.driver.commands);
    });

    test("it holds nothing on the provider until a session opens", () => {
      expect(create().provider?.listeners() ?? 0).toBe(0);
    });

    test("a session has a native handle, and a check answers a valid observation", async () => {
      const { session } = open(create());

      expect(session.native).toBeTypeOf("object");

      expectDraft(
        await session.check({ signal: new AbortController().signal }),
      );
      session.dispose?.();
    });

    test("a provider that does not prepare never reports a prepared target", async () => {
      const fixture = create();
      const { session, heard } = open(fixture);

      await session.check({ signal: new AbortController().signal });
      fixture.provider?.update();
      session.dispose?.();

      if (fixture.route.driver.prepares) {
        return;
      }

      expect(heard.prepared).toBe(0);
    });

    test("disposing the session removes every listener it held on the provider", () => {
      const fixture = create();
      const { session } = open(fixture);

      session.dispose?.();

      expect(fixture.provider?.listeners() ?? 0).toBe(0);
    });

    test("a change the provider reports after disposal is not reported on", () => {
      const fixture = create();
      const { session, heard } = open(fixture);

      session.dispose?.();

      const before = { ...heard };

      fixture.provider?.update();

      expect(heard).toEqual(before);
    });

    test("a session can be opened again after it was disposed", () => {
      const fixture = create();

      open(fixture).session.dispose?.();
      open(fixture).session.dispose?.();

      expect(fixture.provider?.listeners() ?? 0).toBe(0);
    });
  });
};
