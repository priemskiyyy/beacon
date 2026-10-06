import type { DisruptionParticipant } from "@priemskiyyy/beacon";
import { useEffect, useRef } from "react";

import { useResolvedBeacon } from "src/hooks/internal/useResolvedBeacon";
import type { ReactBeacon } from "src/types/ReactBeacon";

/**
 * Registers a participant while the component is mounted, and unregisters it
 * on unmount. Beacon always calls the latest participant you passed, so a
 * closure over current state never goes stale and a render never registers
 * again. A reservation the participant already holds stays valid after the
 * component unmounts, as long as the service behind it lives.
 *
 * @example
 * ```ts
 * useDisruption({
 *   name: "draft-editor",
 *   impacts: ["document-replacement"],
 *   reserve: () => (dirty ? { status: "blocked", code: "unsaved-draft" } : { status: "reserved", release: resume }),
 * });
 * ```
 */
export const useDisruption = (
  participant: DisruptionParticipant,
  beacon?: ReactBeacon,
) => {
  const { disruptions } = useResolvedBeacon(beacon, "useDisruption");
  const latest = useRef(participant);

  useEffect(() => {
    latest.current = participant;
  });

  useEffect(
    () =>
      disruptions.register({
        get name() {
          return latest.current.name;
        },
        get impacts() {
          return latest.current.impacts;
        },
        reserve: (context) => latest.current.reserve(context),
      }),
    [disruptions],
  );
};
