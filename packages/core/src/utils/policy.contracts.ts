// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that the policy does not check it again at runtime.
import { createReleaseSource } from "src/utils/createReleaseSource";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { Beacon } from "src/utils/Beacon";
import { supportPolicy } from "src/utils/supportPolicy";
import { targetRoute } from "src/utils/targetRoute";
import type { NoneDecision } from "src/types/NoneDecision";
import type { TargetDecision } from "src/types/TargetDecision";

type Manifest = {
  web: TargetDecision | NoneDecision;
  support: { minimum: number };
};

const manifest = createReleaseSource<Manifest>({
  name: "manifest",
  read: async () => {
    throw new Error("Never run.");
  },
});

const web = targetRoute({
  subject: "web",
  source: manifest.select((document) => document.web),
  mechanism: createUpdateMechanism({
    name: "inert",
    open: () => ({ native: {} }),
    commands: {},
  }),
});

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

export const supported = new Beacon({
  scope,
  running: { boot: { id: "boot-1" } },
  routes: { web },
  policy: supportPolicy({
    source: manifest.select((document) => document.support),
    evaluate: ({ minimum }) => ({
      status: minimum > 1 ? "unsupported" : "supported",
      reasons: [],
      remediation: [{ route: "web", level: "required" }],
    }),
  }),
});

export const unconfigured = new Beacon({
  scope,
  running: { boot: { id: "boot-1" } },
  routes: { web },
  // @ts-expect-error A policy cannot name a route this Beacon does not have.
  policy: supportPolicy({
    source: manifest.select((document) => document.support),
    evaluate: () => ({
      status: "unsupported",
      reasons: [],
      remediation: [{ route: "ghost", level: "required" }],
    }),
  }),
});

supportPolicy({
  source: manifest.select((document) => document.support),
  // @ts-expect-error A verdict is one of the four statuses, not a made-up one.
  evaluate: () => ({ status: "fine", reasons: [], remediation: [] }),
});

supportPolicy({
  source: manifest.select((document) => document.support),
  evaluate: ({ minimum }) => {
    // @ts-expect-error The evaluator receives the view the source projected, and nothing else of the document.
    minimum.toUpperCase();

    return { status: "supported", reasons: [], remediation: [] };
  },
});

new Beacon({
  scope,
  running: { boot: { id: "boot-1" } },
  routes: { web },
  // POL-11 Two support authorities cannot be configured, so none wins silently: an aggregate is the application's own policy.
  // @ts-expect-error There is one support authority, not a list of them.
  policy: [
    supportPolicy({
      source: manifest.select((document) => document.support),
      evaluate: () => ({ status: "supported", reasons: [], remediation: [] }),
    }),
  ],
});
