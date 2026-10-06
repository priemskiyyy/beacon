import { createReleaseDriver } from "@priemskiyyy/beacon";
import type { CommandMap } from "@priemskiyyy/beacon";

import type { PlayNative } from "src/types/PlayNative";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayOptions } from "src/types/PlayOptions";
import type { PlayPrepared } from "src/types/PlayPrepared";
import { FLOW_NOT_ALLOWED } from "src/utils/constants/reasons";
import { PlaySession } from "src/utils/PlaySession";
import { bindSession, getSession } from "src/utils/sessions";

const commands = {
  startFlexibleUpdate: {
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "provider-current",
    run: async ({ native, offer }) => {
      const session = getSession(native);

      if (session === undefined) {
        return { status: "cancelled", stage: "session-ended" };
      }

      if (!offer.flows.includes("flexible")) {
        return { status: "unsupported", reason: FLOW_NOT_ALLOWED };
      }

      if (!(await session.confirm(offer))) {
        return { status: "stale" };
      }

      const result = await session.downloadFlexible();

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
  startImmediateUpdate: {
    reference: "offer",
    impacts: ["native-update-flow", "javascript-restart"],
    binding: "provider-current",
    run: async ({ native, offer }) => {
      const session = getSession(native);

      if (session === undefined) {
        return { status: "cancelled", stage: "session-ended" };
      }

      if (!offer.flows.includes("immediate")) {
        return { status: "unsupported", reason: FLOW_NOT_ALLOWED };
      }

      if (!(await session.confirm(offer))) {
        return { status: "stale" };
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
  completeUpdate: {
    reference: "prepared",
    impacts: ["javascript-restart"],
    binding: "provider-current",
    run: async ({ native }) => {
      await native.bridge.completeUpdate();

      return { status: "accepted", receipt: { kind: "completion-requested" } };
    },
  },
} satisfies CommandMap<PlayNative, PlayOffer, PlayPrepared>;

/**
 * Google Play in-app updates as a Beacon route, over a native bridge you
 * inject. Play owns eligibility, the flows and the version order: an offer
 * names a version code, carries the flows Play allows now, and comes from a
 * fresh query, never from a manifest. `startFlexibleUpdate` answers when Play
 * says the download ended and prepares the update without restarting the app;
 * `completeUpdate` is a separate, guarded command. `startImmediateUpdate` is
 * disruptive from the moment the flow starts, and resumes one Play still
 * holds. Every command reconfirms the offer against Play first. Nothing here
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
