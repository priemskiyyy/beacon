import { describe, expect, test } from "vitest";

import type { ReleaseDriverConformanceOptions } from "src/testing/types/ReleaseDriverConformanceOptions";
import type { ReleaseDriverFixture } from "src/testing/types/ReleaseDriverFixture";
import type { CommandMap } from "src/types/CommandMap";
import type { DriverEmitter } from "src/types/DriverEmitter";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningApplication } from "src/types/RunningApplication";

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

// Only an identity carries a fact the types cannot: the strings that name it are not empty.
const expectDraft = <TOffer extends RouteBody>(
  draft: ObservationDraft<TOffer>,
) => {
  if (draft.status !== "available") {
    return;
  }

  expectIdentity(draft.offer.release.identity);
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
  getInitial: () => RUNNING,
  subscribe: () => () => {},
};

/**
 * Registers the contract every provider driver keeps: it holds nothing on the
 * provider until a session opens, its check answers an observation whose
 * identity is named, what it reports while open is well formed, it reports a
 * prepared target only when it declared that it prepares, it holds no listener
 * on the provider once its session is disposed, it reports nothing after that,
 * and a session can be opened again.
 * Call it at the top level of `src/conformance.test.ts`, over a fake provider
 * SDK. What its commands declare is the types' to check, not this suite's.
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

    test("it holds nothing on the provider until a session opens", () => {
      expect(create().provider?.listeners() ?? 0).toBe(0);
    });

    test("a check answers an observation whose identity is named", async () => {
      const { session } = open(create());

      expectDraft(
        await session.check({ signal: new AbortController().signal }),
      );
      session.dispose?.();
    });

    test("what the provider reports while a session is open is well formed", () => {
      const fixture = create();
      const { session } = open(fixture);

      fixture.provider?.update();
      session.dispose?.();
    });

    test("a provider that does not prepare never reports a prepared target", () => {
      const fixture = create();

      if (fixture.route.driver.prepares) {
        return;
      }

      const { session, heard } = open(fixture);

      fixture.provider?.update();
      session.dispose?.();

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
