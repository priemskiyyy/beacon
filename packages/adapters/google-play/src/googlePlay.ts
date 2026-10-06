import { createReleaseDriver } from "@priemskiyyy/beacon";
import type { CommandMap, ProviderResult } from "@priemskiyyy/beacon";

import type { PlayNative } from "src/types/PlayNative";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayOptions } from "src/types/PlayOptions";
import type { PlayPrepared } from "src/types/PlayPrepared";
import type { PlayReceipt } from "src/types/PlayReceipt";
import { PlaySession } from "src/utils/PlaySession";
import { bindSession, getSession } from "src/utils/sessions";

// A command answers its own receipt, and annotating it keeps the receipt's `kind` a literal.
type Answer<TKind extends PlayReceipt["kind"]> = Promise<
  ProviderResult<Extract<PlayReceipt, { kind: TKind }>>
>;

const commands = {
  download: {
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "provider-current",
    run: async ({ native, offer, signal }): Answer<"update-downloaded"> => {
      const session = getSession(native);
      const refusal = await session.confirmFlow(offer, "flexible");

      if (refusal !== null) {
        return refusal;
      }

      const result = await session.downloadFlexible(offer.release, signal);

      if (result.status === "downloaded") {
        return { status: "accepted", receipt: { kind: "update-downloaded" } };
      }

      if (result.status === "cancelled") {
        return result;
      }

      if (result.status === "session-ended") {
        return { status: "indeterminate", reason: "session-ended" };
      }

      return {
        status: "failed",
        error: {
          code: "COMMAND_FAILED",
          message: "Play reported that the download failed.",
        },
      };
    },
  },
  update: {
    reference: "offer",
    impacts: ["native-update-flow", "javascript-restart"],
    binding: "provider-current",
    run: async ({
      native,
      offer,
      signal,
    }): Answer<"immediate-flow-started"> => {
      const refusal = await getSession(native).confirmFlow(offer, "immediate");

      if (refusal !== null) {
        return refusal;
      }

      // The wait may have ended while Play was asked, and the check shares its turn with the start. The caller has been told already; this releases the route that wait left unresolved.
      if (signal.aborted) {
        return { status: "cancelled", stage: "session-ended" };
      }

      const flow = await native.bridge.startImmediate();

      if (flow === "cancelled") {
        return { status: "cancelled", stage: "consent" };
      }

      if (flow === "failed") {
        return {
          status: "failed",
          error: {
            code: "COMMAND_FAILED",
            message: "Play reported that the update flow failed.",
          },
        };
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
    run: async ({ native }): Answer<"completion-requested"> => {
      await native.bridge.completeUpdate();

      return { status: "accepted", receipt: { kind: "completion-requested" } };
    },
  },
} satisfies CommandMap<PlayNative, PlayOffer, PlayPrepared>;

/**
 * Google Play in-app updates as a Beacon route, over a native bridge you
 * inject. Play owns eligibility, the flows and the version order: an offer
 * names a version code, carries the flows Play allows now, and comes from a
 * fresh query, never from a manifest. `download` answers when Play
 * says the download ended and prepares the update without restarting the app;
 * `restart` is a separate, guarded command. `update` is
 * disruptive from the moment the flow starts, and resumes one Play still
 * holds. Every start reconfirms the offer against Play first. Nothing here
 * is proof of an installation: only a later boot shows the running build, and
 * only a real device with a real Play distribution validates the flow. A
 * bridge belongs to one open session at a time: a second Beacon that opens a
 * route on the same bridge fails to open it, as `DRIVER_FAILED`.
 *
 * @example
 * ```ts
 * const routes = { binary: googlePlay({ bridge: NativeModules.PlayUpdates }) };
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
        bridge,
        application: scope.application,
        emit,
      });

      const unbind = bindSession(native, session);

      return {
        native,
        check: session.check,
        reconcile: session.reconcile,
        dispose: () => {
          unbind();
          session.dispose();
        },
      };
    },
    commands,
  });
