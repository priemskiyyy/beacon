import { compareIdentities } from "@priemskiyyy/beacon";
import type { DriverEmitter } from "@priemskiyyy/beacon";

import type { DownloadResult } from "src/types/internal/DownloadResult";
import type { Refusal } from "src/types/internal/Refusal";
import type { PlayBridge } from "src/types/PlayBridge";
import type { PlayInstallEvent } from "src/types/PlayInstallEvent";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayPrepared } from "src/types/PlayPrepared";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";
import {
  DOWNLOADED_IDENTITY,
  FLOW_NOT_ALLOWED,
} from "src/utils/constants/reasons";
import { readProgress } from "src/utils/readProgress";
import { readUpdateInfo } from "src/utils/readUpdateInfo";

type PlaySessionOptions = {
  bridge: PlayBridge;
  application: string;
  emit: DriverEmitter<PlayOffer, PlayPrepared>;
};

const UNNAMED_DOWNLOAD: PlayPrepared["release"] = {
  identity: { status: "unknown", reason: DOWNLOADED_IDENTITY },
};

/**
 * Owns what one session listens to and asks: Play's install events, installed
 * before any flow can start, and its fresh query. A downloaded update is
 * prepared under the release of the query that said so, or of the flow that
 * awaits it, and under no name when neither did: an event names no version. It
 * answers a flexible flow only when Play says the download ended, and falls
 * silent for good when disposed.
 */
export class PlaySession {
  #bridge: PlayBridge;
  #application: string;
  #emit: DriverEmitter<PlayOffer, PlayPrepared>;
  #waiting: {
    release: PlayPrepared["release"];
    settle: (result: DownloadResult) => void;
  } | null = null;
  #stop: () => void;
  #disposed = false;

  constructor({ bridge, application, emit }: PlaySessionOptions) {
    this.#bridge = bridge;
    this.#application = application;
    this.#emit = emit;
    this.#stop = bridge.addInstallListener(this.#reportInstall);
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
   * Whether the flow may start now, and if not, why. It must have been allowed
   * for the offer the user was shown, and Play, asked again, must still make
   * that offer and still allow it. Play allows one use of its update
   * information, so this only confirms the offer stands; the bridge acquires a
   * fresh one to start with.
   */
  confirmFlow = async (
    offer: PlayOffer,
    flow: PlayOffer["flows"][number],
  ): Promise<Refusal | null> => {
    if (!offer.flows.includes(flow)) {
      return { status: "unsupported", reason: FLOW_NOT_ALLOWED };
    }

    const fresh = await this.#confirm(offer);

    if (fresh === null) {
      return { status: "stale" };
    }

    if (!fresh.flows.includes(flow)) {
      return { status: "unsupported", reason: FLOW_NOT_ALLOWED };
    }

    return null;
  };

  /** Starts the flexible flow for the release the user was shown and answers when Play says the download ended; the listener is armed first, so nothing is missed. */
  downloadFlexible = async (
    release: PlayPrepared["release"],
    signal: AbortSignal,
  ): Promise<DownloadResult> => {
    // Nothing is started for a wait that ended while Play was asked, and the check shares its turn with the start. The caller has been told already; this releases the route that wait left unresolved.
    if (signal.aborted) {
      return { status: "cancelled", stage: "session-ended" };
    }

    const ended = new Promise<DownloadResult>((settle) => {
      this.#waiting = { release, settle };
    });

    const flow = await this.#bridge.startFlexible().catch((cause: unknown) => {
      // No flow started, so nothing awaits one and no later event is this download's.
      this.#waiting = null;

      throw cause;
    });

    if (flow === "cancelled") {
      this.#waiting = null;

      return { status: "cancelled", stage: "consent" };
    }

    if (flow === "failed") {
      this.#waiting = null;

      return { status: "failed" };
    }

    return ended;
  };

  dispose = () => {
    this.#disposed = true;
    this.#settle({ status: "session-ended" });
    this.#stop();
  };

  // What Play offers now if it is still what the user was shown, else `null`; the fresh offer is the one whose flows decide what may start.
  async #confirm(offer: PlayOffer): Promise<PlayOffer | null> {
    const { observation } = this.#read(await this.#bridge.getUpdateInfo());

    if (observation.status !== "available") {
      return null;
    }

    const fresh = observation.offer;

    if (fresh.inProgress !== offer.inProgress) {
      return null;
    }

    if (fresh.inProgress) {
      return fresh;
    }

    if (
      compareIdentities(fresh.release.identity, offer.release.identity) !==
      "same"
    ) {
      return null;
    }

    return fresh;
  }

  #read(info: PlayUpdateInfo) {
    const reading = readUpdateInfo(info, this.#application);

    if (reading.installStatus === "downloaded" && !this.#disposed) {
      this.#prepare(reading.release);
    }

    return reading;
  }

  #prepare(release: PlayPrepared["release"]) {
    this.#emit.prepared({
      status: "ready",
      value: { release, flow: "flexible" },
    });
  }

  // The bridge is the application's, and its native side may deliver an event that was already on its way when the listener was removed.
  #reportInstall = (event: PlayInstallEvent) => {
    if (this.#disposed) {
      return;
    }

    if (event.status === "downloading") {
      this.#emit.progress(readProgress(event));

      return;
    }

    if (event.status === "downloaded") {
      this.#emit.progress(null);
      this.#prepare(this.#waiting?.release ?? UNNAMED_DOWNLOAD);
      this.#settle({ status: "downloaded" });

      return;
    }

    if (event.status === "canceled") {
      this.#emit.progress(null);
      this.#settle({ status: "cancelled", stage: "download" });

      return;
    }

    if (event.status !== "failed") {
      return;
    }

    this.#emit.progress(null);
    this.#settle({ status: "failed" });
  };

  #settle(result: DownloadResult) {
    this.#waiting?.settle(result);
    this.#waiting = null;
  }
}
