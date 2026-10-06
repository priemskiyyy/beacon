import { BeaconError, compareIdentities } from "@priemskiyyy/beacon";
import type { DriverEmitter } from "@priemskiyyy/beacon";

import type { PlayResult } from "src/types/internal/PlayResult";
import type { Refusal } from "src/types/internal/Refusal";
import type { PlayInstallEvent } from "src/types/PlayInstallEvent";
import type { PlayNative } from "src/types/PlayNative";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayPrepared } from "src/types/PlayPrepared";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";
import { DOWNLOADED_IDENTITY } from "src/utils/constants/identities";
import { FLOW_NOT_ALLOWED } from "src/utils/constants/reasons";
import { readFlow } from "src/utils/readFlow";
import { readProgress } from "src/utils/readProgress";
import { readUpdateInfo } from "src/utils/readUpdateInfo";

type PlaySessionOptions = {
  native: PlayNative;
  application: string;
  emit: DriverEmitter<PlayOffer, PlayPrepared>;
};

type Download = PlayResult<"update-downloaded">;

const DOWNLOAD_FAILED = "Play reported that the download failed.";

// What Play makes now is what the user was shown: the same version, or the same flow it still holds.
const isSameOffer = (fresh: PlayOffer, offer: PlayOffer) => {
  if (fresh.inProgress !== offer.inProgress) {
    return false;
  }

  if (fresh.inProgress) {
    return true;
  }

  return (
    compareIdentities(fresh.release.identity, offer.release.identity) === "same"
  );
};

/**
 * Owns what one session listens to and asks: Play's install events, installed
 * before any flow can start, and its fresh query. A downloaded update is
 * prepared under the release of the query that said so, or of the flow that
 * awaits it, and under no name when neither did: an event names no version. It
 * answers a flexible flow only when Play says the download ended, and falls
 * silent for good when disposed. A command reaches the session it runs on
 * through `PlaySession.of`.
 */
export class PlaySession {
  static #open = new WeakMap<PlayNative, PlaySession>();

  /** The session a command runs on, found by the handle it was given. A command runs only on the handle of an open session, so any other handle is a provider that is not open. */
  static of(native: PlayNative) {
    const session = PlaySession.#open.get(native);

    if (session === undefined) {
      throw new BeaconError({
        code: "DRIVER_FAILED",
        message: "The provider is not open.",
      });
    }

    return session;
  }

  #native: PlayNative;
  #application: string;
  #emit: DriverEmitter<PlayOffer, PlayPrepared>;
  #waiting: {
    release: PlayPrepared["release"];
    settle: (result: Download) => void;
  } | null = null;
  #stop: () => void;
  #disposed = false;

  constructor({ native, application, emit }: PlaySessionOptions) {
    this.#native = native;
    this.#application = application;
    this.#emit = emit;
    this.#stop = native.bridge.addInstallListener(this.#reportInstall);
    PlaySession.#open.set(native, this);
  }

  /** A fresh query of Play, as an observation; a download it finds finished is prepared. */
  check = async () => this.#read(await this.#native.bridge.getUpdateInfo());

  /** The same query after a restart or a return to the app, reported through the route. */
  reconcile = async () => {
    const observation = await this.check();

    if (this.#disposed) {
      return;
    }

    this.#emit.observation(observation);
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

    const observation = this.#read(await this.#native.bridge.getUpdateInfo());

    if (
      observation.status !== "available" ||
      !isSameOffer(observation.offer, offer)
    ) {
      return { status: "stale" };
    }

    if (!observation.offer.flows.includes(flow)) {
      return { status: "unsupported", reason: FLOW_NOT_ALLOWED };
    }

    return null;
  };

  /** Starts the flexible flow for the release the user was shown and answers when Play says the download ended; the listener is armed first, so nothing is missed. */
  downloadFlexible = async (
    release: PlayPrepared["release"],
    signal: AbortSignal,
  ): Promise<Download> => {
    // Nothing is started for a wait that ended while Play was asked, and the check shares its turn with the start. The caller has been told already; this releases the route that wait left unresolved.
    if (signal.aborted) {
      return { status: "cancelled", stage: "session-ended" };
    }

    const ended = new Promise<Download>((settle) => {
      this.#waiting = { release, settle };
    });

    const flow = await this.#native.bridge
      .startFlexible()
      .catch((cause: unknown) => {
        // No flow started, so nothing awaits one and no later event is this download's.
        this.#waiting = null;

        throw cause;
      });

    const refusal = readFlow(flow, DOWNLOAD_FAILED);

    if (refusal !== null) {
      this.#waiting = null;

      return refusal;
    }

    return ended;
  };

  dispose = () => {
    this.#disposed = true;
    PlaySession.#open.delete(this.#native);
    this.#settle({ status: "indeterminate", reason: "session-ended" });
    this.#stop();
  };

  // A query that finds the download done prepares it, whoever asked.
  #read(info: PlayUpdateInfo) {
    const { observation, prepared } = readUpdateInfo(info, this.#application);

    if (prepared !== null && !this.#disposed) {
      this.#emit.prepared(prepared);
    }

    return observation;
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
      this.#emit.prepared({
        status: "ready",
        value: {
          release: this.#waiting?.release ?? { identity: DOWNLOADED_IDENTITY },
        },
      });
      this.#settle({
        status: "accepted",
        receipt: { kind: "update-downloaded" },
      });

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
    this.#settle({
      status: "failed",
      error: { code: "COMMAND_FAILED", message: DOWNLOAD_FAILED },
    });
  };

  #settle(result: Download) {
    this.#waiting?.settle(result);
    this.#waiting = null;
  }
}
