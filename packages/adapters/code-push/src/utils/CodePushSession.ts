import { BeaconError, compareIdentities } from "@priemskiyyy/beacon";
import type {
  DriverEmitter,
  ObservationDraft,
  ProviderResult,
  ReleaseIdentity,
} from "@priemskiyyy/beacon";

import type { CodePushDownloadReceipt } from "src/types/CodePushDownloadReceipt";
import type { CodePushNative } from "src/types/CodePushNative";
import type { CodePushOffer } from "src/types/CodePushOffer";
import type { CodePushPrepared } from "src/types/CodePushPrepared";
import type { CodePushReloadReceipt } from "src/types/CodePushReloadReceipt";
import type { DownloadProgressLike } from "src/types/DownloadProgressLike";
import type { RemotePackageLike } from "src/types/RemotePackageLike";
import {
  INSTALL_UNCONFIRMED,
  NO_PACKAGE_FOR_BINARY,
  PACKAGE_HASH_MISSING,
  PREVIOUSLY_ROLLED_BACK,
} from "src/utils/constants/reasons";
import { readOffer } from "src/utils/readOffer";
import { readPending } from "src/utils/readPending";
import { readProgress } from "src/utils/readProgress";

type CodePushSessionOptions = {
  native: CodePushNative;
  emit: DriverEmitter<CodePushOffer, CodePushPrepared>;
};

/** The package the last check found, with the identity the offer for it was given. */
type Offered = { identity: ReleaseIdentity; remote: RemotePackageLike };

/**
 * Owns what one session asks of CodePush and keeps between its calls: the
 * package the last check found, which only a download can use, and the
 * progress it passes on. It adds no listener of its own, since the SDK
 * subscribes to its download events for as long as a download runs, and it
 * falls silent for good when disposed. A command reaches the session it runs
 * on through `CodePushSession.of`.
 */
export class CodePushSession {
  static #open = new WeakMap<CodePushNative, CodePushSession>();

  /** The session a command runs on, found by the handle it was given. A command runs only on the handle of an open session, so any other handle is a provider that is not open. */
  static of(native: CodePushNative) {
    const session = CodePushSession.#open.get(native);

    if (session === undefined) {
      throw new BeaconError({
        code: "DRIVER_FAILED",
        message: "The provider is not open.",
      });
    }

    return session;
  }

  #native: CodePushNative;
  #emit: DriverEmitter<CodePushOffer, CodePushPrepared>;
  #offered: Offered | null = null;
  #disposed = false;

  constructor({ native, emit }: CodePushSessionOptions) {
    this.#native = native;
    this.#emit = emit;
    CodePushSession.#open.set(native, this);
  }

  /**
   * Asks CodePush for a package, with no argument since the forks disagree on
   * their order. A package becomes an offer, and `null` becomes no offer that
   * names what it cannot say: CodePush answers `null` for no update, for an
   * update that needs a newer binary, for the hash the device runs and for the
   * hash inside the binary, and the forks add silent cases of their own, such
   * as a release history that could not be fetched.
   */
  check = async (context: {
    signal: AbortSignal;
  }): Promise<ObservationDraft<CodePushOffer>> => {
    const { signal } = context;
    const remote = await this.#native.codePush.checkForUpdate();

    if (remote === null) {
      this.#keep(null, signal);

      return {
        status: "none",
        reason: "no-decision",
        detail: NO_PACKAGE_FOR_BINARY,
      };
    }

    const offer = readOffer(remote);

    // A package that names nothing is kept too: no offer for it is ever downloaded, since an unknown identity equals nothing.
    this.#keep({ identity: offer.release.identity, remote }, signal);

    return { status: "available", offer };
  };

  /** What a restart left behind: the package CodePush lists as pending is prepared, and none says nothing, since it cannot say that nothing is prepared. */
  reconcile = async () => {
    const pending = await this.#readPending();

    if (pending === null || this.#disposed) {
      return;
    }

    this.#emit.prepared({ status: "ready", value: pending });
  };

  /**
   * Downloads the package the offer names, or answers stale when the last
   * check found another, and installs it for the next start. Only CodePush
   * listing it as pending says it is staged. The install is the step that can
   * make a start pick the package up, so it is not started for a wait that
   * ended during the download.
   */
  download = async (
    offer: CodePushOffer,
    signal: AbortSignal,
  ): Promise<ProviderResult<CodePushDownloadReceipt>> => {
    const { identity } = offer.release;

    if (identity.status === "unknown") {
      return { status: "unsupported", reason: PACKAGE_HASH_MISSING };
    }

    if (offer.failedInstall) {
      return { status: "unsupported", reason: PREVIOUSLY_ROLLED_BACK };
    }

    const { codePush } = this.#native;
    const offered = this.#offered;

    if (
      offered === null ||
      compareIdentities(offered.identity, identity) !== "same"
    ) {
      return { status: "stale" };
    }

    const local = await offered.remote.download(this.#reportProgress);

    if (signal.aborted) {
      return { status: "cancelled", stage: "session-ended" };
    }

    // The binding is to this package: nothing else is installed in its place.
    if (local.packageHash !== identity.value) {
      return {
        status: "failed",
        error: {
          code: "COMMAND_FAILED",
          message: "CodePush downloaded another package than the one offered.",
        },
      };
    }

    // Downloading deletes the folder named by the package's hash, and once it is installed that folder is the one CodePush runs or will run from. Its own check never offers a package it holds, so the package is spent here, whatever the install answers, and only a new check offers one again. A check that found another package meanwhile keeps its own.
    if (this.#offered === offered) {
      this.#offered = null;
    }

    await local.install(codePush.InstallMode.ON_NEXT_RESTART);

    // The install has been asked for and may have taken effect, so a read that fails is a package CodePush did not confirm, not a command that failed.
    const staged = await this.#readPending().catch(() => null);

    if (
      staged === null ||
      compareIdentities(staged.release.identity, identity) !== "same"
    ) {
      return { status: "indeterminate", reason: INSTALL_UNCONFIRMED };
    }

    if (!this.#disposed) {
      this.#emit.prepared({ status: "ready", value: staged });
    }

    return {
      status: "accepted",
      receipt: {
        kind: "update-staged",
        update: { hash: identity.value, label: staged.label },
      },
    };
  };

  /**
   * Asks CodePush to restart for the package it lists as pending, when that is
   * the one the user agreed to. The call only requests: CodePush holds the
   * restart back while the application has disallowed restarts, and it does not
   * say whether it restarted.
   */
  reload = async (
    prepared: CodePushPrepared,
    signal: AbortSignal,
  ): Promise<ProviderResult<CodePushReloadReceipt>> => {
    const pending = await this.#readPending();

    if (
      pending === null ||
      compareIdentities(pending.release.identity, prepared.release.identity) !==
        "same"
    ) {
      return { status: "stale" };
    }

    // The wait may have ended while CodePush was asked, and a restart reaches whatever the user has open.
    if (signal.aborted) {
      return { status: "cancelled", stage: "session-ended" };
    }

    await this.#native.codePush.restartApp(true);

    return { status: "accepted", receipt: { kind: "reload-requested" } };
  };

  dispose = () => {
    this.#disposed = true;
    this.#offered = null;
    CodePushSession.#open.delete(this.#native);
  };

  // What CodePush lists as pending: the package an install left for the next start, until that start loads it.
  async #readPending() {
    const { codePush } = this.#native;

    return readPending(
      await codePush.getUpdateMetadata(codePush.UpdateState.PENDING),
    );
  }

  // An answer that came after the wait or the session ended is not one the route took, so it keeps what the answer before it left.
  #keep(offered: Offered | null, signal: AbortSignal) {
    if (signal.aborted || this.#disposed) {
      return;
    }

    this.#offered = offered;
  }

  // The SDK may deliver an event that was already on its way when the session ended.
  #reportProgress = (progress: DownloadProgressLike) => {
    if (this.#disposed) {
      return;
    }

    this.#emit.progress(readProgress(progress));
  };
}
