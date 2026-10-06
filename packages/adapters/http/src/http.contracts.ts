// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that the adapter does not check it again at runtime.
import { createUpdateMechanism, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseSource,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import { http } from "src/http";
import type { HttpAnswer } from "src/types/HttpAnswer";

type ApiManifest = { web: TargetDecision | NoneDecision };

declare const api: {
  manifest: (options: {
    signal: AbortSignal;
    etag: string | null;
  }) => Promise<HttpAnswer<ApiManifest>>;
};

export const manifest = http({
  request: ({ signal, validator }) => api.manifest({ signal, etag: validator }),
});

expectTypeOf(manifest).toEqualTypeOf<ReleaseSource<ApiManifest>>();

const mechanism = createUpdateMechanism({
  name: "inert",
  open: () => ({ native: {} }),
  commands: {},
});

export const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.web),
  mechanism,
});

http({
  // @ts-expect-error -- an answer is changed or not modified.
  request: () => ({ status: "unchanged" }),
});

// @ts-expect-error -- a changed answer carries its document.
http({ request: () => ({ status: "changed" }) });

http({
  // @ts-expect-error -- an expiry is epoch milliseconds, not a date string.
  request: () => ({ status: "not-modified", expiresAt: "2026-10-24" }),
});

http({
  request: () => ({
    status: "changed",
    document: {},
    // @ts-expect-error -- a revision is opaque or ordered.
    revision: { kind: "sequence", value: "1" },
  }),
});

// @ts-expect-error -- the client call is required: this adapter makes no request of its own.
http({ name: "manifest" });
