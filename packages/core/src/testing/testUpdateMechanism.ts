import { describe, expect, test } from "vitest";

import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";
import type { UpdateMechanism } from "src/types/UpdateMechanism";
import { expectValidCommands } from "src/testing/expectValidCommands";

/** A mechanism under test, over a fake platform created for this test alone. */
export type UpdateMechanismFixture<
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  mechanism: UpdateMechanism<TNative, TCommands>;
  /** How many times the mechanism has opened its platform. */
  opens: () => number;
  /** What the mechanism holds on the platform right now, such as listeners; leave it out when it holds nothing. */
  held?: () => number;
};

/** What a mechanism's conformance suite is run over. */
export type UpdateMechanismConformanceOptions<
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
> = {
  name: string;
  create: () => UpdateMechanismFixture<TNative, TCommands>;
};

/**
 * Registers the contract every update mechanism keeps: it touches its
 * platform only when a session opens, every command declares a known
 * reference, binding and set of impacts, a session can be opened again after
 * it ended, and ending it releases what it held. Call it at the top level of
 * `src/conformance.test.ts`, over a fake platform.
 *
 * It cannot check what a command really does to the platform, or that its
 * receipt claims no more than was observed: keep those in the adapter's own
 * tests.
 *
 * @example
 * ```ts
 * testUpdateMechanism({
 *   name: "browser-reload",
 *   create: () => {
 *     const location = fakeLocation();
 *
 *     return { mechanism: browserReload({ location }), opens: location.reads };
 *   },
 * });
 * ```
 */
export const testUpdateMechanism = <
  TNative extends object,
  TCommands extends CommandMap<TNative, RouteBody, RouteBody>,
>({
  name,
  create,
}: UpdateMechanismConformanceOptions<TNative, TCommands>) => {
  describe(`update mechanism: ${name}`, () => {
    test("it has a name for diagnostics", () => {
      expect(create().mechanism.name).not.toBe("");
    });

    test("creating it and reading its commands touch the platform not at all", () => {
      const { mechanism, opens } = create();

      Object.keys(mechanism.commands);

      expect(opens()).toBe(0);
    });

    test("every command declares a known reference, binding and impacts", () => {
      expectValidCommands(create().mechanism.commands);
    });

    test("opening gives a native handle, and it can be opened again after it ended", () => {
      const { mechanism, opens } = create();

      const first = mechanism.open();

      first.dispose?.();

      const second = mechanism.open();

      second.dispose?.();

      expect(opens()).toBe(2);
    });

    test("ending a session releases what it held on the platform", () => {
      const { mechanism, held } = create();

      if (held === undefined) {
        return;
      }

      const before = held();
      const session = mechanism.open();

      session.dispose?.();

      expect(held()).toBe(before);
    });
  });
};
