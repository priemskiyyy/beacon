import type { ReleaseScope } from "@priemskiyyy/beacon";

/** Timeline entries kept, newest first. */
export const TIMELINE_LENGTH = 200;

/** Milliseconds between the real-time ticks that move the lab's clock. */
export const TICK_INTERVAL = 250;

/** The build the first document runs. */
export const INITIAL_BUILD = 1;

/** Milliseconds an answer of the release service holds. */
export const MANIFEST_TTL = 60_000;

/** Milliseconds a check may wait for the release service, Beacon's own default made visible. */
export const CHECK_TIMEOUT = 10_000;

/** Boots in a row that may leave a target unreached before the journal says the budget is spent. */
export const JOURNAL_BUDGET = 2;

/** Who assigns build identities, and the application the scope speaks for. */
export const APPLICATION = "dev.beacon.lab";

export const ARTIFACT_DOMAIN = "web-artifact";

export const MANIFEST_NAME = "release-manifest";

export const REVISION_DOMAIN = "lab-deployments";

export const REVISION_EPOCH = "v1";

export const ISSUER = "lab-release-service";

/** The application's own block code, raised by its unsaved draft. */
export const UNSAVED_DRAFT = "unsaved-draft";

export const MANIFEST_FAILURE = "The release service answered 503.";

export const SCOPE: ReleaseScope = {
  application: APPLICATION,
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

/** Milliseconds the release service takes to answer in the apps, as a network does. */
export const REQUEST_LATENCY = 400;
