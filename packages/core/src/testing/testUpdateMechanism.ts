import { describe, expect, test } from "vitest";

import type { UpdateMechanismConformanceOptions } from "src/testing/types/UpdateMechanismConformanceOptions";
import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";

/**
 * Registers the contract every update mechanism keeps: it touches its
 * platform only when a session opens, a session can be opened again after it
 * ended, and ending it releases what it held. Call it at the top level of
 * `src/conformance.test.ts`, over a fake platform. What its commands declare
 * is the types' to check, not this suite's.
 *
 * It cannot check what a command really does to the platform, or that its
 * receipt claims no more than was observed: keep those in the adapter's own
 * tests.
 *
 * @example
 * ```ts
 * testUpdateMechanism({
 *   name: "relaunch",
 *   create: () => {
 *     let opened = 0;
 *
 *     const mechanism = relaunch(() => {
 *       opened += 1;
 *
 *       return { relaunch: () => {} };
 *     });
 *
 *     return { mechanism, opens: () => opened };
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

    test("it can be opened again after it ended", () => {
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
