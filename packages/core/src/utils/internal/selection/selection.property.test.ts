import fc from "fast-check";
import { expect, test } from "vitest";

import type { CandidateDecision } from "src/types/CandidateDecision";
import type { Compatibility } from "src/types/Compatibility";
import type { IdentityRelation } from "src/types/IdentityRelation";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningRelease } from "src/types/RunningRelease";
import type { TargetDecision } from "src/types/TargetDecision";
import { BeaconError } from "src/utils/BeaconError";
import { compareIdentities } from "src/utils/compareIdentities";
import { createEvidence } from "src/utils/internal/feeds/createEvidence";
import { hasLapsed } from "src/utils/internal/feeds/hasLapsed";
import { selectNewer } from "src/utils/internal/selection/selectNewer";
import { selectTarget } from "src/utils/internal/selection/selectTarget";
import { integer } from "src/utils/versions/integer";

// A failing property prints its seed and path: replay it with `fc.assert(property, { seed, path })`. The seed is never fixed to make a failure go away.

// Few authorities, domains and values, so that two identities collide often enough for every relation to be drawn.
const known: fc.Arbitrary<ReleaseIdentity> = fc.record({
  status: fc.constant("known"),
  authority: fc.constantFrom("com.example.notes", "com.other"),
  domain: fc.constantFrom("web-artifact", "expo-update"),
  value: fc.constantFrom("a", "b", "c"),
});

const unknown: fc.Arbitrary<ReleaseIdentity> = fc.record({
  status: fc.constant("unknown"),
  reason: fc.constantFrom("embedded-rollback", "not-reported"),
});

const identity = fc.oneof(known, known, unknown);

const compatibility: fc.Arbitrary<Compatibility | undefined> = fc.constantFrom(
  undefined,
  { status: "compatible", basis: "runtime-version" },
  { status: "incompatible", reasons: ["runtime"] },
  { status: "delegated", authority: "google-play" },
  { status: "unknown", reason: "not-asked" },
  { status: "not-applicable" },
);

const relate = (left: ReleaseIdentity, right: ReleaseIdentity) =>
  compareIdentities(left, right);

test("VER-01 two identities are the same only when authority, domain and value all agree, and an unknown one is never either", () => {
  fc.assert(
    fc.property(identity, identity, (left, right) => {
      const relation = relate(left, right);

      // Symmetric, and never the same as itself when it is unknown.
      expect(relate(right, left)).toBe(relation);

      if (left.status === "unknown" || right.status === "unknown") {
        expect(relation).toBe("incomparable");

        return;
      }

      const sameWords =
        left.authority === right.authority && left.domain === right.domain;

      if (!sameWords) {
        expect(relation).toBe("incomparable");

        return;
      }

      expect(relation).toBe(left.value === right.value ? "same" : "different");
    }),
    { numRuns: 2_000 },
  );
});

test("CORE-13 an identity is the same as itself only when it is known", () => {
  fc.assert(
    fc.property(identity, (value) => {
      const expected: IdentityRelation =
        value.status === "known" ? "same" : "incomparable";

      expect(relate(value, { ...value })).toBe(expected);
    }),
    { numRuns: 500 },
  );
});

// The table of the specification, written apart from the code that follows it.
type Running = RunningRelease | null;

const running = (value: ReleaseIdentity): RunningRelease => ({
  identity: value,
  label: null,
  raw: {},
});

const runningOf = fc.oneof(fc.constant<Running>(null), identity.map(running));

test("VER-12 target mode offers a different comparable identity whatever its order, and never infers a difference from missing data", () => {
  fc.assert(
    fc.property(
      runningOf,
      identity,
      compatibility,
      (current, wanted, compat) => {
        const decision: TargetDecision = {
          kind: "target",
          release: {
            identity: wanted,
            ...(compat === undefined ? {} : { compatibility: compat }),
          },
        };

        const selection = selectTarget({ decision, running: current });

        if (compat?.status === "incompatible") {
          expect(selection).toMatchObject({
            status: "none",
            reason: "incompatible",
          });

          return;
        }

        if (current === null || current.identity.status === "unknown") {
          expect(selection).toMatchObject({
            status: "inconclusive",
            reason: "missing-current-identity",
          });

          return;
        }

        const relation = relate(current.identity, wanted);

        if (relation === "incomparable") {
          expect(selection).toMatchObject({
            status: "inconclusive",
            reason: "incomparable-identity",
          });

          return;
        }

        if (relation === "same") {
          expect(selection).toMatchObject({
            status: "none",
            reason: "same-identity",
          });

          return;
        }

        expect(selection).toEqual({
          status: "offer",
          release: decision.release,
        });
      },
    ),
    { numRuns: 3_000 },
  );
});

const orders = fc.integer({ min: 0, max: 4 });

test("VER-02 newer mode offers only a candidate that orders newer, and says why it does not otherwise", () => {
  fc.assert(
    fc.property(
      runningOf,
      identity,
      compatibility,
      orders,
      fc.option(orders, { nil: null }),
      (current, wanted, compat, candidateOrder, currentOrder) => {
        const decision: CandidateDecision<number> = {
          kind: "candidate",
          release: {
            identity: wanted,
            order: candidateOrder,
            ...(compat === undefined ? {} : { compatibility: compat }),
          },
        };

        const select = () =>
          selectNewer({
            decision,
            running: current,
            currentOrder,
            version: integer(),
          });

        if (compat?.status === "incompatible") {
          expect(select()).toMatchObject({
            status: "none",
            reason: "incompatible",
          });

          return;
        }

        if (currentOrder === null) {
          expect(select()).toMatchObject({
            status: "inconclusive",
            reason: "missing-current-order",
          });

          return;
        }

        const relation: IdentityRelation =
          current === null ? "incomparable" : relate(current.identity, wanted);

        if (candidateOrder === currentOrder) {
          const reason =
            relation === "different"
              ? "equal-order-different-identity"
              : "equal-order";

          expect(select()).toMatchObject({ status: "none", reason });

          return;
        }

        // An order that differs for the release that is running contradicts itself.
        if (relation === "same") {
          expect(select).toThrow(BeaconError);

          return;
        }

        if (candidateOrder < currentOrder) {
          expect(select()).toMatchObject({
            status: "none",
            reason: "older-than-current",
          });

          return;
        }

        expect(select()).toEqual({
          status: "offer",
          release: decision.release,
        });
      },
    ),
    { numRuns: 3_000 },
  );
});

test("CORE-02 evidence has lapsed exactly when its expiry is not after now, and never un-lapses as time goes on", () => {
  fc.assert(
    fc.property(
      fc.option(fc.integer({ min: 0, max: 10_000 }), { nil: null }),
      fc.integer({ min: 0, max: 10_000 }),
      fc.integer({ min: 0, max: 10_000 }),
      fc.integer({ min: 0, max: 10_000 }),
      (expiresAt, receivedAt, earlier, gap) => {
        const evidence = createEvidence({
          source: "manifest",
          origin: "network",
          receivedAt,
          expiresAt,
          issuer: null,
          revision: null,
        });

        const later = earlier + gap;

        // A document that never expires lapses never, and one that expired on arrival lapses always.
        if (expiresAt === null) {
          expect(hasLapsed(evidence, later)).toBe(false);

          return;
        }

        // Evidence that had expired by the time it arrived says so, and lapses at every instant.
        expect(evidence.freshness).toBe(
          expiresAt <= receivedAt ? "expired" : "fresh",
        );
        expect(hasLapsed(evidence, earlier)).toBe(
          evidence.freshness === "expired" || expiresAt <= earlier,
        );
        expect(
          !hasLapsed(evidence, earlier) || hasLapsed(evidence, later),
        ).toBe(true);
      },
    ),
    { numRuns: 2_000 },
  );
});
