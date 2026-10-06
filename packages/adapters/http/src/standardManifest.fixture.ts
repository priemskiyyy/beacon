import { SCOPE } from "src/fakeBackend.fixture";
import type { ManifestResponse } from "src/types/ManifestResponse";
import type { RouteDeclarations } from "src/types/RouteDeclarations";

export const ROUTES = {
  web: { kind: "target" },
  binary: { kind: "candidate", order: "text" },
} satisfies RouteDeclarations;

// Five minutes after the manifest was issued, five minutes before it expires.
export const NOW = Date.parse("2026-09-27T10:05:00Z");

export type JsonObject = Record<string, unknown>;

export const buildRelease = (value: string): JsonObject => ({
  identity: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value,
  },
});

export const buildWebRoute = (): JsonObject => ({
  kind: "target",
  release: {
    ...buildRelease("web-build-a"),
    label: "September recovery release",
    metadata: { releaseNotesKey: "recovery-208" },
    compatibility: { status: "not-applicable" },
  },
});

export const buildBinaryRoute = (): JsonObject => ({
  kind: "candidate",
  release: { ...buildRelease("ios-build-9"), order: "2.5.0" },
});

export const buildSupport = (): JsonObject => ({
  revision: "policy-43",
  subject: "web",
  deniedReleaseIds: ["web-build-b"],
  reasonCode: "known-regression",
  remediationRoute: "web",
});

export const buildManifest = (): JsonObject => ({
  schemaVersion: 1,
  application: SCOPE.application,
  environment: SCOPE.environment,
  platform: SCOPE.platform,
  distribution: SCOPE.distribution,
  decisionRevision: {
    kind: "ordered",
    domain: "notes-web-deployments",
    epoch: "production-v1",
    value: "208",
  },
  issuedAt: "2026-09-27T10:00:00Z",
  expiresAt: "2026-09-27T10:10:00Z",
  routes: { web: buildWebRoute(), binary: buildBinaryRoute() },
  support: buildSupport(),
});

// Edits a copy of the valid manifest, so each test names the one thing it breaks.
export const manifestWith = (edit: (manifest: JsonObject) => void): string => {
  const manifest = buildManifest();

  edit(manifest);

  return JSON.stringify(manifest);
};

type FakeResponseOptions = {
  status?: number;
  contentType?: string | null;
  etag?: string | null;
  contentLength?: number | null;
  redirected?: boolean;
  text?: string;
};

// A response of only what a runtime with no browser cache and no stream offers.
export const fakeResponse = ({
  status = 200,
  contentType = "application/json",
  etag = null,
  contentLength = null,
  redirected = false,
  text = JSON.stringify(buildManifest()),
}: FakeResponseOptions = {}): ManifestResponse & { reads: number } => {
  const headers = new Map<string, string>();

  if (contentType !== null) {
    headers.set("content-type", contentType);
  }

  if (etag !== null) {
    headers.set("etag", etag);
  }

  if (contentLength !== null) {
    headers.set("content-length", String(contentLength));
  }

  const response = {
    status,
    redirected,
    headers: { get: (name: string) => headers.get(name) ?? null },
    reads: 0,
    text: async () => {
      response.reads += 1;

      return text;
    },
  };

  return response;
};
