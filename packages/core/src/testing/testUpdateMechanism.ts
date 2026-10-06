import { describe, expect, test } from "vitest";

import type { UpdateMechanismConformanceOptions } from "src/testing/types/UpdateMechanismConformanceOptions";
import type { CommandMap } from "src/types/CommandMap";
import type { RouteBody } from "src/types/RouteBody";

/**
 * Registers the contract every update mechanism keeps: it opens nothing and
 * holds nothing until a session opens, a session can be opened again after it
 * ended, and ending it releases what it held. Call it at the top level of
 * `src/conformance.test.ts`, over a fake platform. The suite counts the
 * mechanism's `open` calls itself, so `create` returns the mechanism, and adds
 * `held` only when the fake can say what the mechanism holds on the platform.
 * What its commands declare is the types' to check, not this suite's.
 *
 * It cannot check what a command really does to the platform, or that its
 * receipt claims no more than was observed: keep those in the adapter's own
 * tests.
 *
 * @example
 * ```ts
 * testUpdateMechanism({
 *   name: "relaunch",
 *   create: () => ({ mechanism: relaunch(() => ({ relaunch: () => {} })) }),
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
  // Counts the calls to `open`, the one thing the suite can see of the platform; a fake that cannot say what is held holds nothing.
  const createCounted = () => {
    const { mechanism, held = () => 0 } = create();
    const opened = { count: 0 };

    return {
      mechanism: {
        ...mechanism,
        open: () => {
          opened.count += 1;

          return mechanism.open();
        },
      },
      opens: () => opened.count,
      held,
    };
  };

  describe(`update mechanism: ${name}`, () => {
    test("it has a name for diagnostics", () => {
      expect(create().mechanism.name).not.toBe("");
    });

    test("creating it and reading its commands open no session and hold nothing", () => {
      const { mechanism, opens, held } = createCounted();

      Object.keys(mechanism.commands);

      expect(opens()).toBe(0);
      expect(held()).toBe(0);
    });

    test("it can be opened again after it ended", () => {
      const { mechanism } = createCounted();

      expect(() => {
        mechanism.open().dispose?.();
        mechanism.open().dispose?.();
      }).not.toThrow();
    });

    test("ending a session releases what it held on the platform", () => {
      const { mechanism, held } = createCounted();
      const before = held();
      const session = mechanism.open();

      session.dispose?.();

      expect(held()).toBe(before);
    });
  });
};
