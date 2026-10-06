import fc from "fast-check";
import { expect, test } from "vitest";

import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { SCOPE } from "src/utils/Beacon.fixture";
import {
  ACCEPTED_RELOAD,
  createWebCommandBeacon,
} from "src/utils/commands.fixture";
import { target } from "src/utils/routes.fixture";

// A failing property prints its seed and path: replay it with `fc.assert(property, { seed, path })`, and its counterexample is the trace. The seed is never fixed to make a failure go away.

// Beacon driven by random traces of what an application, a source, a provider and the clock can do, in any order. After every step the state must keep the laws below, and when the trace ends every call must have settled.
type Step =
  | { kind: "start" }
  | { kind: "stop" }
  | { kind: "check"; mode: "join" | "after-current" }
  | { kind: "routeCheck" }
  | { kind: "answer"; build: string }
  | { kind: "failRead" }
  | { kind: "advance"; milliseconds: number }
  | { kind: "setNow"; epoch: number }
  | { kind: "reload"; withSignal: boolean }
  | {
      kind: "settleRun";
      how: "accepted" | "failed" | "cancelled" | "indeterminate";
    }
  | { kind: "abort"; which: number }
  | { kind: "acknowledge" }
  | { kind: "replaceScope"; environment: string }
  | { kind: "storage"; how: "hold" | "release" | "fail" | "mend" }
  | { kind: "dispose" };

const steps: fc.Arbitrary<Step> = fc.oneof(
  { weight: 4, arbitrary: fc.constant<Step>({ kind: "start" }) },
  { weight: 2, arbitrary: fc.constant<Step>({ kind: "stop" }) },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant("check"),
      mode: fc.constantFrom("join", "after-current"),
    }),
  },
  { weight: 2, arbitrary: fc.constant<Step>({ kind: "routeCheck" }) },
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant("answer"),
      build: fc.constantFrom("web-build-a", "web-build-b", "web-build-c"),
    }),
  },
  { weight: 2, arbitrary: fc.constant<Step>({ kind: "failRead" }) },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant("advance"),
      milliseconds: fc.integer({ min: 0, max: 700_000 }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant("setNow"),
      epoch: fc.integer({ min: 0, max: 2_000_000 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant("reload"),
      withSignal: fc.boolean(),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant("settleRun"),
      how: fc.constantFrom("accepted", "failed", "cancelled", "indeterminate"),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ kind: fc.constant("abort"), which: fc.nat(6) }),
  },
  { weight: 3, arbitrary: fc.constant<Step>({ kind: "acknowledge" }) },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant("replaceScope"),
      environment: fc.constantFrom("production", "staging", "canary"),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant("storage"),
      how: fc.constantFrom("hold", "release", "fail", "mend"),
    }),
  },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "dispose" }) },
);

// Every continuation a settled call queued has run once this returns.
const drain = async () => {
  for (let turn = 0; turn < 3; turn += 1) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
};

test("LIFE-01 under any trace of calls, answers, failures, aborts and clock moves, the state keeps its laws and every call settles", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc
        .array(steps, { minLength: 1, maxLength: 40 })
        .map((rest): Step[] => [
          { kind: "start" },
          { kind: "check", mode: "join" },
          { kind: "answer", build: "web-build-a" },
          ...rest,
        ]),
      async (trace) => {
        const storage = createMockJournalStorage();

        const context = createWebCommandBeacon({
          journal: { mode: "best-effort", storage },
        });

        const { beacon, clock, mock, runs } = context;
        const web = beacon.route("web");
        const calls: Array<{ settled: boolean; label: string }> = [];
        const controllers: AbortController[] = [];
        const guard = { reserved: 0, released: 0 };

        beacon.disruptions.register({
          name: "drafts",
          reserve: () => {
            guard.reserved += 1;

            return {
              status: "reserved",
              resume: () => {
                guard.released += 1;
              },
            };
          },
        });

        const track = <TResult>(label: string, promise: Promise<TResult>) => {
          const call = { settled: false, label };

          calls.push(call);
          promise.then(
            () => {
              call.settled = true;
            },
            () => {
              call.settled = true;
              throw new Error(`${label} rejected: the API never rejects.`);
            },
          );
        };

        let lastRevision = web.state.get().revision;
        let frozen: ReturnType<typeof web.state.get> | null = null;
        let disposed = false;
        let storageHeld = false;

        const apply = async (step: Step) => {
          if (step.kind === "start") {
            if (!disposed) {
              beacon.start();
            }

            return;
          }

          if (step.kind === "stop") {
            beacon.stop();

            return;
          }

          if (step.kind === "check") {
            track("check", beacon.check({ mode: step.mode }));

            return;
          }

          if (step.kind === "routeCheck") {
            track("route check", web.check());

            return;
          }

          if (step.kind === "answer") {
            if (mock.stats().held === 0) {
              return;
            }

            mock.resolve({
              document: {
                web: target(step.build),
                policy: { minimum: "1.0.0" },
              },
              expiresAt: clock.now() + 600_000,
            });

            return;
          }

          if (step.kind === "failRead") {
            if (mock.stats().held === 0) {
              return;
            }

            mock.reject(new Error("the source is down"));

            return;
          }

          if (step.kind === "advance") {
            clock.advance(step.milliseconds);

            return;
          }

          if (step.kind === "setNow") {
            clock.setNow(step.epoch);

            return;
          }

          if (step.kind === "reload") {
            const { observation } = web.state.get();

            if (observation.status !== "available") {
              return;
            }

            const controller = new AbortController();

            controllers.push(controller);
            track(
              "reload",
              web.reload({
                offer: observation.offer,
                ...(step.withSignal ? { signal: controller.signal } : {}),
              }),
            );

            return;
          }

          if (step.kind === "settleRun") {
            const run = runs.shift();

            if (run === undefined) {
              return;
            }

            if (step.how === "accepted") {
              run.settleWith(ACCEPTED_RELOAD);
            } else if (step.how === "failed") {
              run.fail(new Error("the browser refused"));
            } else if (step.how === "cancelled") {
              run.settleWith({ status: "cancelled", stage: "dialog" });
            } else {
              run.settleWith({
                status: "indeterminate",
                reason: "no-callback",
              });
            }

            return;
          }

          if (step.kind === "abort") {
            controllers[step.which % Math.max(controllers.length, 1)]?.abort();

            return;
          }

          if (step.kind === "acknowledge") {
            web.acknowledge();

            return;
          }

          if (step.kind === "storage") {
            if (step.how === "hold") {
              storageHeld = true;
              storage.holdWrites();
              storage.holdReads();
            } else if (step.how === "release") {
              storageHeld = false;
              storage.releaseWrites();
              storage.releaseReads();
            } else if (step.how === "fail") {
              storage.failWrites();
            } else {
              storage.failWrites(null);
            }

            return;
          }

          if (step.kind === "replaceScope") {
            if (!disposed) {
              beacon.replaceScope({ ...SCOPE, environment: step.environment });
            }

            return;
          }

          disposed = true;
          beacon.dispose();
          frozen = web.state.get();
        };

        const holds = () => guard.reserved - guard.released;

        for (const step of trace) {
          await apply(step);
          await drain();

          const state = web.state.get();

          const { operation } = state;

          // Snapshots only move forward, and a Beacon that ended stops changing.
          expect(state.revision).toBeGreaterThanOrEqual(lastRevision);
          lastRevision = state.revision;

          if (frozen !== null) {
            expect(web.state.get()).toBe(frozen);
            expect(beacon.status.get().state).toBe("disposed");
          }

          // Nothing is armed once no session is open, but for the deadline of the one call the journal's storage has not answered: the queue belongs to the Beacon and not to a session, so that call is given up on at its deadline or when the Beacon is disposed.
          if (beacon.status.get().state !== "running") {
            expect(
              clock.pendingTimers(),
              "timers with no session",
            ).toBeLessThanOrEqual(storageHeld && !disposed ? 1 : 0);
          }

          // A guard is held by a command that is under way or unresolved, never by one that ended.
          if (operation.state === "idle") {
            expect(holds(), "guards held at the end or while idle").toBe(0);
          }

          // A command that may have taken effect keeps its guard until the application acknowledges it, and a Beacon that was disposed gives every guard back.
          if (operation.state === "indeterminate") {
            expect(holds()).toBe(disposed ? 0 : 1);
          }

          expect(holds()).toBeLessThanOrEqual(1);
          expect(holds()).toBeGreaterThanOrEqual(0);
        }

        // The end of the trace: the Beacon goes, and whatever the provider still owed is answered late.
        beacon.dispose();
        await drain();

        for (const run of runs.splice(0)) {
          run.settleWith(ACCEPTED_RELOAD);
        }

        await drain();

        expect(
          clock.pendingTimers(),
          "timers at the end or with no session",
        ).toBe(0);
        expect(holds(), "guards held at the end or while idle").toBe(0);
        expect(calls.filter(({ settled }) => !settled)).toEqual([]);
      },
    ),
    { numRuns: 1_500 },
  );
});
