// Names the documentation's snippets use without declaring, as an application
// would have them. The imports make this a module, so `declare global` puts
// the names in every snippet's scope while the types stay private to this file.
import type {
  Beacon as BeaconClass,
  createBootId as createBootIdFactory,
  targetRoute as targetRouteFactory,
  FeedRoute,
  NoneDecision,
  Observation,
  Release,
  ReleaseScope,
  ReleaseSource,
  RunningReader,
  RunningReaders,
  TargetDecision,
} from "@priemskiyyy/beacon";
import type {
  browserReload as browserReloadFactory,
  BrowserNative,
} from "@priemskiyyy/beacon-browser";
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";
import type { AppStoreLookupResponse } from "@priemskiyyy/beacon-app-store";
import type { HttpAnswer } from "@priemskiyyy/beacon-http";
import type { Pulse as PulseInstance } from "@priemskiyyy/pulse";

type WebDocument = { web: TargetDecision | NoneDecision };

type WebRoute = FeedRoute<
  WebDocument,
  Release<null>,
  BrowserNative,
  ReturnType<typeof browserReloadFactory>["commands"]
>;

declare global {
  const scope: ReleaseScope;
  // The application's Beacon, with the browser reload route the guides read.
  const beacon: BeaconClass<{ web: WebRoute }>;
}

// snippets: readme-only
// Everything below is for the package READMEs, which show one part of a larger
// application and rely on what the reader already has.
declare global {
  const Beacon: typeof BeaconClass;
  const createBootId: typeof createBootIdFactory;
  const targetRoute: typeof targetRouteFactory;
  const browserReload: typeof browserReloadFactory;
  const running: RunningReaders;
  const readWebRelease: RunningReader;
  const APP_STORE_ID: string;
  const manifest: ReleaseSource<WebDocument>;
  const web: WebRoute;
  const observation: Extract<
    Observation<"web", { release: Release<null> }>,
    { status: "available" }
  >;
  const session: { userId: string };
  const playBridge: PlayBridge;
  const UpdateBanner: () => null;
  const isDirty: () => boolean;
  const resume: () => void;
  const parseManifest: (input: unknown) => WebDocument;
  const parseLookup: (input: unknown) => AppStoreLookupResponse;
  const fetchManifest: (options: {
    signal: AbortSignal;
    validator: string | null;
  }) => Promise<unknown>;
  const parseManifestResponse: (input: unknown) => HttpAnswer<WebDocument>;
  // The real Pulse, a sibling of Beacon and a development dependency of this workspace.
  const pulse: PulseInstance;
}
