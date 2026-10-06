// Names the documentation's snippets use without declaring, as an application
// would have them. The imports make this a module, so `declare global` puts
// the names in every snippet's scope while the types stay private to this file.
import type {
  Beacon as BeaconClass,
  FeedRoute,
  NoneDecision,
  Observation,
  Release,
  ReleaseIdentity,
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

type WebDocument = { web: TargetDecision | NoneDecision };

type WebRoute = FeedRoute<
  WebDocument,
  Release<null>,
  BrowserNative,
  ReturnType<typeof browserReloadFactory>["commands"]
>;

declare global {
  const BOOT_ID: string;
  const scope: ReleaseScope;
}

// snippets: readme-only
// Everything below is for the package READMEs, which show one part of a larger
// application and rely on what the reader already has.
declare global {
  const Beacon: typeof BeaconClass;
  const targetRoute: typeof import("@priemskiyyy/beacon").targetRoute;
  const browserReload: typeof browserReloadFactory;
  const running: RunningReaders;
  const readWebRelease: RunningReader;
  const BUILD_IDENTITY: ReleaseIdentity;
  const BUILD_LABEL: string;
  const APP_STORE_ID: string;
  const manifest: ReleaseSource<WebDocument>;
  const web: WebRoute;
  const beacon: BeaconClass<{ web: WebRoute }>;
  const observation: Extract<
    Observation<"web", { release: Release<null> }>,
    { status: "available" }
  >;
  const session: { userId: string };
  const NativeModules: { PlayUpdates: PlayBridge };
  const UpdateBanner: () => null;
  const isDirty: () => boolean;
  const resume: () => void;
  const parseManifest: (input: unknown) => WebDocument;
  const parseLookup: (input: unknown) => AppStoreLookupResponse;
  const fetchManifest: (request: {
    signal: AbortSignal;
    validator: string | null;
  }) => Promise<unknown>;
  const parseManifestResponse: (input: unknown) => HttpAnswer<WebDocument>;
  // The Pulse library is a sibling of Beacon and is not a dependency.
  const pulse: {
    on: (event: "foreground", listener: () => void | Promise<void>) => () => void;
  };
}
