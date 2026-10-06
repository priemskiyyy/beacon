import type {
  DecisionRevision,
  NoneDecision,
  ReleaseScope,
  TargetDecision,
} from "@priemskiyyy/beacon";

import type { HttpAnswer } from "src/types/HttpAnswer";
import type { HttpFetchContext } from "src/types/HttpFetchContext";

export type FakeManifest = { web: TargetDecision | NoneDecision };

export const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

export const buildRead = (
  signal: AbortSignal = new AbortController().signal,
) => ({
  scope: SCOPE,
  signal,
  attempt: 1,
});

const buildManifest = (build: string): FakeManifest => ({
  web: {
    kind: "target",
    release: {
      identity: {
        status: "known",
        authority: "com.example.notes",
        domain: "web-artifact",
        value: build,
      },
      label: `Build ${build}`,
    },
  },
});

// A manifest endpoint with an ETag: the same validator gets `not-modified`, anything else gets the document.
export const fakeBackend = () => {
  const fetches: HttpFetchContext[] = [];

  const state = {
    build: "web-build-a",
    validator: '"208"',
    revision: {
      kind: "ordered",
      domain: "web",
      epoch: "v1",
      value: "208",
    } satisfies DecisionRevision,
    expiresAt: 601_000,
  };

  return {
    fetches,
    state,
    reads: () => fetches.length,
    fetch: async (
      context: HttpFetchContext,
    ): Promise<HttpAnswer<FakeManifest>> => {
      fetches.push(context);

      if (context.validator === state.validator) {
        return { status: "not-modified", expiresAt: state.expiresAt };
      }

      return {
        status: "changed",
        document: buildManifest(state.build),
        validator: state.validator,
        revision: state.revision,
        digest: state.build,
        issuer: "release-service",
        expiresAt: state.expiresAt,
      };
    },
    publish: (build: string, validator: string) => {
      state.build = build;
      state.validator = validator;
    },
  };
};
