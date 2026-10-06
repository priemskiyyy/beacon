import fc from "fast-check";
import { expect, test } from "vitest";

import { createTestClock } from "src/mock/createTestClock";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import { createSession } from "src/utils/internal/feeds/FeedRecord.fixture";
import { SharedRead } from "src/utils/internal/reads/SharedRead";

type Step =
  | { kind: "read"; mode: ReadOptions["mode"]; withSignal: boolean }
  | { kind: "abort"; caller: number }
  | { kind: "answer" }
  | { kind: "fail" }
  | { kind: "timeout" }
  | { kind: "restart" };

const steps: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    kind: fc.constant("read"),
    mode: fc.constantFrom("join", "after-current"),
    withSignal: fc.boolean(),
  }),
  fc.record({ kind: fc.constant("abort"), caller: fc.nat(8) }),
  fc.constant({ kind: "answer" }),
  fc.constant({ kind: "fail" }),
  fc.constant({ kind: "timeout" }),
  fc.constant({ kind: "restart" }),
);

// Every continuation a settled caller queued has run once this returns.
const flush = async () => {
  for (let turn = 0; turn < 6; turn += 1) {
    await Promise.resolve();
  }
};

type HeldRead = {
  resolve: (answer: string) => void;
  reject: (error: Error) => void;
};

test("HTTP-05 callers that join, leave, wait after the read and outlive their session are each told once, with one read in flight at a time", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(steps, { maxLength: 25 }), async (script) => {
      const clock = createTestClock({ now: 0 });
      const held: HeldRead[] = [];
      const told: number[] = [];
      const controllers: AbortController[] = [];
      const pending: Array<Promise<unknown>> = [];
      const flight = { active: 0, most: 0, started: 0, ended: 0 };
      let session = createSession();

      const end = () => {
        flight.ended += 1;
        flight.active -= 1;
      };

      const read = new SharedRead<string, string>({
        clock,
        timeout: 1_000,
        perform: () =>
          new Promise<string>((resolve, reject) => {
            held.push({ resolve, reject });
          }),
        accept: (_attempt, answer) => answer,
        hooks: {
          started: () => {
            flight.started += 1;
            flight.active += 1;
            flight.most = Math.max(flight.most, flight.active);
          },
          accepted: end,
          failed: end,
          record: () => {},
        },
        errors: {
          failed: { code: "SOURCE_FAILED", message: "The read failed." },
          invalid: { code: "INVALID_DOCUMENT", message: "Invalid." },
          timeout: { code: "SOURCE_TIMEOUT", message: "Too slow." },
        },
      });

      for (const step of script) {
        if (step.kind === "read") {
          const controller = new AbortController();
          const caller = told.length;

          told.push(0);
          controllers.push(controller);
          pending.push(
            read
              .read(session, {
                mode: step.mode,
                signal: step.withSignal ? controller.signal : undefined,
              })
              .then(() => {
                told[caller] = (told[caller] ?? 0) + 1;
              }),
          );
        }

        if (step.kind === "abort") {
          controllers[step.caller % Math.max(controllers.length, 1)]?.abort();
        }

        if (step.kind === "answer") {
          held.shift()?.resolve("an answer");
        }

        if (step.kind === "fail") {
          held.shift()?.reject(new Error("The source failed."));
        }

        if (step.kind === "timeout") {
          clock.advance(1_000);
        }

        if (step.kind === "restart") {
          session.scope.dispose();
          session = createSession();
        }

        await flush();
        expect(flight.most).toBeLessThanOrEqual(1);
      }

      session.scope.dispose();

      // What a source answers after its read was ended is ignored.
      for (const late of held) {
        late.resolve("a late answer");
      }

      await flush();
      await Promise.all(pending);

      expect(told.every((count) => count === 1)).toBe(true);
      expect(flight.started).toBe(flight.ended);
    }),
    { numRuns: 300 },
  );
});
