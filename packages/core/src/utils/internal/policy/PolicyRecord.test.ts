import { expect, test } from "vitest";

import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { ErasedPolicy } from "src/types/internal/ErasedPolicy";
import type { RouteState } from "src/types/internal/RouteState";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningApplication } from "src/types/RunningApplication";
import type { SupportVerdict } from "src/types/SupportVerdict";
import type { BeaconError } from "src/utils/BeaconError";
import { createReleaseSource } from "src/utils/createReleaseSource";
import { commitChange } from "src/utils/internal/observable/commitChange";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { PolicyRecord } from "src/utils/internal/policy/PolicyRecord";

const SUPPORTED: SupportVerdict = {
  status: "supported",
  reasons: [],
  remediation: [],
};

const createAccepted = (): AcceptedFeed => ({
  document: {},
  claim: { revision: null, digest: null },
  evidence: {
    source: "manifest",
    origin: "network",
    receivedAt: 0,
    expiresAt: null,
    freshness: "fresh",
    issuer: null,
    revision: null,
  },
  attempt: 1,
});

const running: RunningApplication = {
  boot: { id: "boot-1" },
  revision: 1,
  native: { state: "unconfigured" },
  bundle: { state: "unconfigured" },
  web: { state: "unconfigured" },
  worker: { state: "unconfigured" },
};

const BODY: RouteBody = {
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "android-version-code",
      value: "120",
    },
  },
};

const NOTHING: RouteState = {
  revision: 1,
  check: { state: "idle" },
  observation: { status: "unknown", reason: "not-checked" },
  prepared: { status: "unknown" },
  operation: { state: "idle" },
};

const OFFERED: RouteState = {
  ...NOTHING,
  observation: {
    status: "available",
    evidence: createAccepted().evidence,
    offer: { ref: { kind: "offer", route: "ota", id: 1 }, ...BODY },
  },
};

const PREPARED: RouteState = {
  ...NOTHING,
  prepared: {
    status: "ready",
    value: { ref: { kind: "prepared", route: "ota", id: 2 }, ...BODY },
    observedAt: 0,
  },
};

const createRecord = (
  evaluate: () => SupportVerdict,
  getRoute: () => RouteState | undefined = () => undefined,
) => {
  const calls = { evaluations: 0 };
  const failures: BeaconError[] = [];

  const source = createReleaseSource<object>({
    name: "manifest",
    read: async () => ({ document: {} }),
  });

  const policy: ErasedPolicy = {
    source: source.select((document) => document),
    evaluate: () => {
      calls.evaluations += 1;

      return evaluate();
    },
  };

  const record = new PolicyRecord({
    policy,
    listeners: new Listeners(() => {}),
    getRoute,
    onFailure: (error) => failures.push(error),
    now: () => 0,
  });

  const update = (accepted: AcceptedFeed, facts = running) => {
    commitChange((transaction) => record.update(transaction, accepted, facts));
  };

  return { record, calls, failures, update };
};

test("the policy is not evaluated again for the feed and the running facts it was evaluated from", () => {
  const { calls, update } = createRecord(() => SUPPORTED);
  const accepted = createAccepted();

  update(accepted);
  update(accepted);

  expect(calls.evaluations).toBe(1);

  update(createAccepted());
  update(accepted, { ...running, revision: 2 });

  expect(calls.evaluations).toBe(3);
});

test("a failed evaluation is reported once while its feed and running facts stand, and again for the next", () => {
  const { record, failures, update } = createRecord(() => {
    throw new Error("bad policy");
  });

  const accepted = createAccepted();

  update(accepted);
  update(accepted);
  update(accepted);

  expect(failures).toHaveLength(1);
  expect(record.getFailure()).toBe(failures[0]);

  update(createAccepted());

  expect(failures).toHaveLength(2);
});

test("a policy that evaluates again after a failure has no failure left", () => {
  const state = { broken: true };

  const { record, failures, update } = createRecord(() => {
    if (state.broken) {
      throw new Error("bad policy");
    }

    return SUPPORTED;
  });

  update(createAccepted());
  state.broken = false;
  update(createAccepted());

  expect(failures).toHaveLength(1);
  expect(record.getFailure()).toBeNull();
  expect(record.state.get()).toMatchObject({
    status: "supported",
    error: null,
  });
});

test("a remediation is usable when its route has an offer or a prepared target now, however long ago it was evaluated", () => {
  const route = { state: NOTHING };

  const { calls, record, update } = createRecord(
    () => ({
      status: "unsupported",
      reasons: [],
      remediation: [{ route: "ota", level: "required" }],
    }),
    () => route.state,
  );

  const accepted = createAccepted();

  const usable = () =>
    record.state.get().evaluation?.remediation.map((entry) => entry.usable);

  update(accepted);
  expect(usable()).toEqual([false]);

  route.state = OFFERED;
  update(accepted);
  expect(usable()).toEqual([true]);

  route.state = PREPARED;
  update(accepted);
  expect(usable()).toEqual([true]);

  route.state = NOTHING;
  update(accepted);
  expect(usable()).toEqual([false]);
  expect(calls.evaluations).toBe(1);
});

test("a remediation that names a route that is not there fails the evaluation", () => {
  const { record, failures, update } = createRecord(() => ({
    status: "unsupported",
    reasons: [],
    remediation: [{ route: "ghost", level: "required" }],
  }));

  update(createAccepted());

  expect(failures).toHaveLength(1);
  expect(record.state.get()).toMatchObject({
    status: "unknown",
    reason: "evaluation-failed",
    error: {
      code: "POLICY_FAILED",
      message:
        'The support policy names the route "ghost", which is not configured.',
    },
  });
});
