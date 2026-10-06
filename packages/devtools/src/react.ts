import { BeaconDevtools as Devtools } from "@priemskiyyy/beacon-devtools";
import { useBeacon } from "@priemskiyyy/beacon-react";
import { createElement, useCallback, useEffect, useState } from "react";

import type { BeaconDevtoolsProps } from "src/types/BeaconDevtoolsProps";
import { DEFAULT_MAX_EVENTS } from "src/utils/constants/defaults";

export type { BeaconDevtoolsProps } from "src/types/BeaconDevtoolsProps";

/**
 * Mounts the inspector for the nearest `BeaconProvider` and follows its
 * Beacon. It renders an empty host element on the server, starts nothing, and
 * removes the inspector when it unmounts. It is for the web: it needs a DOM.
 *
 * @example
 * ```tsx
 * <BeaconProvider beacon={beacon}>
 *   <Application />
 *   {import.meta.env.DEV ? <BeaconDevtools /> : null}
 * </BeaconProvider>
 * ```
 */
export const BeaconDevtools = ({
  initialIsOpen = false,
  maxEvents = DEFAULT_MAX_EVENTS,
}: BeaconDevtoolsProps) => {
  const beacon = useBeacon();

  const [devtools] = useState(
    () => new Devtools({ beacon, initialIsOpen, maxEvents }),
  );

  useEffect(() => {
    devtools.setBeacon(beacon);
  }, [devtools, beacon]);

  useEffect(() => {
    devtools.setMaxEvents(maxEvents);
  }, [devtools, maxEvents]);

  // Stable, so a rerender keeps the mounted inspector. React 19 calls the returned cleanup, never this with null.
  const mountInHost = useCallback(
    (element: HTMLDivElement) => {
      devtools.mount(element);

      return devtools.unmount;
    },
    [devtools],
  );

  return createElement("div", {
    ref: mountInHost,
    "data-beacon-devtools": "",
  });
};
