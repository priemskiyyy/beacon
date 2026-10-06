import {
  Beacon,
  createUpdateMechanism,
  newerRoute,
  supportPolicy,
  targetRoute,
} from "@priemskiyyy/beacon";
import type { RunningRelease } from "@priemskiyyy/beacon";
import { createTestClock } from "@priemskiyyy/beacon/mock";
import { semver } from "@priemskiyyy/beacon/versions";
import { expect, test } from "vitest";

import { SCOPE } from "src/fakeBackend.fixture";
import { http } from "src/http";
import {
  fakeResponse,
  manifestWith,
  NOW,
  ROUTES,
} from "src/standardManifest.fixture";
import { readStandardManifest } from "src/utils/readStandardManifest";

const inert = createUpdateMechanism({
  name: "inert",
  open: () => ({ native: {} }),
  commands: {},
});

const running = (value: string, label: string): RunningRelease => ({
  identity: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value,
  },
  label,
  raw: {},
});

const create = () => {
  const clock = createTestClock({ now: NOW });
  const server = { response: fakeResponse({ etag: '"208"' }) };

  const manifest = http({
    name: "manifest",
    request: async ({ scope }) =>
      readStandardManifest({
        response: server.response,
        scope,
        routes: ROUTES,
        now: clock.now(),
      }),
  });

  const web = targetRoute({
    subject: "web",
    source: manifest.select((document) => document.routes.web),
    mechanism: inert,
  });

  const binary = newerRoute({
    subject: "native",
    source: manifest.select((document) => document.routes.binary),
    version: semver(),
    current: (release) => release?.label ?? null,
    mechanism: inert,
  });

  const policy = supportPolicy({
    source: manifest.select((document) => document.support),
    evaluate: (support, current) => {
      const { web } = current;

      if (
        support === null ||
        web.state !== "known" ||
        web.release.identity.status !== "known" ||
        !support.deniedReleaseIds.includes(web.release.identity.value)
      ) {
        return { status: "supported", reasons: [], remediation: [] };
      }

      return {
        status: "unsupported",
        reasons: [{ code: support.reasonCode, subject: support.subject }],
        remediation: [{ route: support.remediationRoute, level: "required" }],
      };
    },
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: () => running("web-build-c", "Build web-build-c"),
      native: () => running("ios-build-8", "2.4.0"),
    },
    routes: { web, binary },
    policy,
    clock,
  });

  return { beacon, server, clock };
};

test("a checked standard manifest feeds a target route, a newer route and a support policy from one read", async () => {
  const { beacon, server } = create();

  beacon.start();
  await beacon.check();

  expect(beacon.route("web").state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { label: "September recovery release" } },
    evidence: { revision: { kind: "ordered", value: "208" } },
  });

  expect(beacon.route("binary").state.get().observation).toMatchObject({
    status: "available",
    offer: { release: { order: "2.5.0" } },
  });

  expect(beacon.support.get()).toMatchObject({
    status: "supported",
  });

  expect(server.response.reads).toBe(1);
});

test("a support fact that names the release running makes it unsupported, with the route that remedies it", async () => {
  const { beacon, server } = create();

  server.response = fakeResponse({
    text: manifestWith((manifest) => {
      manifest["support"] = {
        revision: "policy-43",
        subject: "web",
        deniedReleaseIds: ["web-build-c"],
        reasonCode: "known-regression",
        remediationRoute: "web",
      };
    }),
  });

  beacon.start();
  await beacon.route("web").check();

  expect(beacon.support.get()).toMatchObject({
    status: "unsupported",
    evaluation: {
      reasons: [{ code: "known-regression", subject: "web" }],
      remediation: [{ route: "web", level: "required" }],
    },
  });
});

test("HTTP-10 an authentication failure fails the check and leaves what was accepted before in place", async () => {
  for (const status of [401, 403]) {
    const { beacon, server } = create();

    beacon.start();
    await beacon.route("web").check();

    const accepted = beacon.route("web").state.get().observation;

    server.response = fakeResponse({ status });

    await expect(beacon.route("web").check()).resolves.toMatchObject({
      status: "failed",
      error: { code: "SOURCE_FAILED" },
    });

    expect(beacon.route("web").state.get().observation).toEqual(accepted);
  }
});

test("HTTP-09 no content, not found and a server error are failed checks, never a decision of no release", async () => {
  for (const status of [204, 404, 503]) {
    const { beacon, server } = create();

    server.response = fakeResponse({ status });

    beacon.start();

    await expect(beacon.route("web").check()).resolves.toMatchObject({
      status: "failed",
      error: { code: "SOURCE_FAILED" },
    });

    expect(beacon.route("web").state.get().observation).toMatchObject({
      status: "unknown",
    });
  }
});

test("HTTP-16 a manifest with a bad support block fails the check whole, and none of it replaces what was accepted", async () => {
  const { beacon, server } = create();

  beacon.start();
  await beacon.route("web").check();
  await beacon.route("binary").check();

  const accepted = beacon.route("web").state.get().observation;

  server.response = fakeResponse({
    text: manifestWith((manifest) => {
      manifest["decisionRevision"] = {
        kind: "ordered",
        domain: "notes-web-deployments",
        epoch: "production-v1",
        value: "209",
      };
      manifest["support"] = { revision: "policy-44" };
    }),
  });

  await expect(beacon.route("web").check()).resolves.toMatchObject({
    status: "failed",
    error: { code: "INVALID_DOCUMENT" },
  });

  expect(beacon.route("web").state.get().observation).toEqual(accepted);
  expect(beacon.support.get().status).toBe("supported");
});
