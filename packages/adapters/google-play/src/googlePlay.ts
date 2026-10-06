import { createReleaseDriver } from "@priemskiyyy/beacon";
import type { CommandMap } from "@priemskiyyy/beacon";

import type { PlayResult } from "src/types/internal/PlayResult";
import type { PlayNative } from "src/types/PlayNative";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayOptions } from "src/types/PlayOptions";
import type { PlayPrepared } from "src/types/PlayPrepared";
import { PlaySession } from "src/utils/PlaySession";
import { readFlow } from "src/utils/readFlow";

const UPDATE_FAILED = "Play reported that the update flow failed.";

const commands = {
  download: {
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "provider-current",
    run: async (context): Promise<PlayResult<"update-downloaded">> => {
      const { native, offer, signal } = context;
      const session = PlaySession.of(native);
      const refusal = await session.confirmFlow(offer, "flexible");

      if (refusal !== null) {
        return refusal;
      }

      return session.downloadFlexible(offer.release, signal);
    },
  },
  update: {
    reference: "offer",
    impacts: ["native-update-flow", "javascript-restart"],
    binding: "provider-current",
    run: async (context): Promise<PlayResult<"immediate-flow-started">> => {
      const { native, offer, signal } = context;

      const refusal = await PlaySession.of(native).confirmFlow(
        offer,
        "immediate",
      );

      if (refusal !== null) {
        return refusal;
      }

      // The wait may have ended while Play was asked, as in `downloadFlexible`.
      if (signal.aborted) {
        return { status: "cancelled", stage: "session-ended" };
      }

      const flow = readFlow(
        await native.bridge.startImmediate(),
        UPDATE_FAILED,
      );

      if (flow !== null) {
        return flow;
      }

      return {
        status: "accepted",
        receipt: { kind: "immediate-flow-started" },
      };
    },
  },
  restart: {
    reference: "prepared",
    impacts: ["javascript-restart"],
    binding: "provider-current",
    run: async (context): Promise<PlayResult<"completion-requested">> => {
      await context.native.bridge.completeUpdate();

      return { status: "accepted", receipt: { kind: "completion-requested" } };
    },
  },
} satisfies CommandMap<PlayNative, PlayOffer, PlayPrepared>;

/**
 * Google Play in-app updates as a Beacon route, over a native bridge you
 * inject. Play owns eligibility, the flows and the version order: an offer
 * names a version code, carries the flows Play allows now, and comes from a
 * fresh query, never from a manifest. `download` answers when Play says the
 * download ended and prepares the update without restarting the app;
 * `restart` is a separate, guarded command. `update` is disruptive from the
 * moment the flow starts, and resumes one Play still holds. Every start
 * reconfirms the offer against Play first. Nothing here is proof of an
 * installation: only a later boot shows the running build, and only a real
 * device with a real Play distribution validates the flow. A bridge belongs
 * to one open session at a time: a second Beacon that opens a route on the
 * same bridge fails to open it, as `DRIVER_FAILED`.
 *
 * @example
 * ```ts
 * const routes = { binary: googlePlay({ bridge: playBridge }) };
 * ```
 */
export const googlePlay = ({ bridge }: PlayOptions) =>
  createReleaseDriver<PlayNative, PlayOffer, PlayPrepared, typeof commands>({
    name: "google-play",
    subject: "native",
    prepares: true,
    exclusive: bridge,
    open: ({ scope, emit }) => {
      const native: PlayNative = { bridge };

      const session = new PlaySession({
        native,
        application: scope.application,
        emit,
      });

      return {
        native,
        check: session.check,
        reconcile: session.reconcile,
        dispose: session.dispose,
      };
    },
    commands,
  });
