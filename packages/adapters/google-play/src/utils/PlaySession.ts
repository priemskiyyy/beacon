import { compareIdentities } from "@priemskiyyy/beacon";
import type { DriverEmitter, Release } from "@priemskiyyy/beacon";

import type { DownloadResult } from "src/types/internal/DownloadResult";
import type { PlayBridge } from "src/types/PlayBridge";
import type { PlayInstallEvent } from "src/types/PlayInstallEvent";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayPrepared } from "src/types/PlayPrepared";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";
import { DOWNLOADED_IDENTITY } from "src/utils/constants/reasons";
import { readProgress } from "src/utils/readProgress";
import { readUpdateInfo } from "src/utils/readUpdateInfo";
import { createDeferred } from "src/utils/createDeferred";

type PlaySessionOptions = {
  bridge: PlayBridge;
  application: string;
  emit: DriverEmitter<PlayOffer, PlayPrepared>;
};

const UNNAMED_DOWNLOAD: Release = {
  identity: { status: "unknown", reason: DOWNLOADED_IDENTITY },
};

/**
 * Owns what one session listens to and asks: Play's install events, installed
 * before any flow can start, and its fresh query. It remembers the release the
 * last query named, so a downloaded update is prepared under it, and it
 * answers a flexible flow only when Play says the download ended. It falls
 * silent for good when disposed.
 */
export class PlaySession {
  #bridge: PlayBridge;
  #application: string;
  #emit: DriverEmitter<PlayOffer, PlayPrepared>;
  #release: Release | null = null;
  #waiting: ReturnType<typeof createDeferred<DownloadResult>> | null = null;
  #stop: () => void;
  #disposed = false;

  constructor({ bridge, application, emit }: PlaySessionOptions) {
    this.#bridge = bridge;
    this.#application = application;
    this.#emit = emit;
    this.#stop = bridge.addInstallListener(this.#handleInstall);
  }

  /** A fresh query of Play, as an observation; a download it finds finished is prepared. */
  check = async () => {
    const info = await this.#bridge.getUpdateInfo();

    return this.#read(info).observation;
  };

  /** The same query after a restart or a return to the app, reported through the route. */
  reconcile = async () => {
    const info = await this.#bridge.getUpdateInfo();

    if (this.#disposed) {
      return;
    }

    this.#emit.observation(this.#read(info).observation);
  };

  /**
   * Whether Play still offers what the user was shown. Play allows one use of
   * its update information, so this only confirms the offer stands; the bridge
   * acquires a fresh one to start with.
   */
  confirm = async (offer: PlayOffer) => {
    const { observation } = this.#read(await this.#bridge.getUpdateInfo());

    if (observation.status !== "available") {
      return false;
    }

    if (observation.offer.inProgress || offer.inProgress) {
      return observation.offer.inProgress && offer.inProgress;
    }

    return (
      compareIdentities(
        observation.offer.release.identity,
        offer.release.identity,
      ) === "same"
    );
  };

  /** Starts the flexible flow and answers when Play says the download ended; the listener is armed first, so nothing is missed. */
  downloadFlexible = async (): Promise<DownloadResult> => {
    const ended = createDeferred<DownloadResult>();

    this.#waiting = ended;

    const flow = await this.#bridge.startFlexible();

    if (flow === "cancelled") {
      this.#waiting = null;

      return { status: "cancelled", stage: "consent" };
    }

    if (flow === "failed") {
      this.#waiting = null;

      return { status: "failed" };
    }

    return ended.promise;
  };

  dispose = () => {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#stop();
    this.#waiting?.resolve({ status: "session-ended" });
    this.#waiting = null;
  };

  #read(info: PlayUpdateInfo) {
    const reading = readUpdateInfo(info, this.#application);

    if (reading.release !== null) {
      this.#release = reading.release;
    }

    if (reading.installStatus === "downloaded" && !this.#disposed) {
      this.#prepare();
    }

    return reading;
  }

  #prepare() {
    this.#emit.prepared({
      status: "ready",
      value: { release: this.#release ?? UNNAMED_DOWNLOAD, flow: "flexible" },
    });
  }

  #handleInstall = (event: PlayInstallEvent) => {
    if (this.#disposed) {
      return;
    }

    if (event.status === "downloading") {
      this.#emit.progress(readProgress(event));

      return;
    }

    if (event.status === "downloaded") {
      this.#emit.progress(null);
      this.#prepare();
      this.#settle({ status: "downloaded" });

      return;
    }

    if (event.status !== "failed" && event.status !== "canceled") {
      return;
    }

    this.#emit.progress(null);
    this.#settle({ status: "failed" });
  };

  #settle(result: DownloadResult) {
    this.#waiting?.resolve(result);
    this.#waiting = null;
  }
}
