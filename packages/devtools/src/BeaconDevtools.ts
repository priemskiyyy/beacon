import { BeaconError } from "@priemskiyyy/beacon";
import { createComponent, createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { render } from "solid-js/web";

import { Devtools } from "src/components/Devtools";
import type { BeaconDevtoolsOptions } from "src/types/BeaconDevtoolsOptions";
import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";
import { DEFAULT_MAX_EVENTS } from "src/utils/constants/defaults";
import { EventLog } from "src/utils/EventLog";

// The DOM refuses an element that cannot host a shadow root, such as an input, or one that already hosts a closed one.
const openRoot = (element: HTMLElement) => {
  if (element.shadowRoot !== null) {
    return element.shadowRoot;
  }

  try {
    return element.attachShadow({ mode: "open" });
  } catch (cause) {
    throw new BeaconError({
      code: "INVALID_CONFIGURATION",
      message:
        "Beacon devtools cannot mount into an element that cannot host a shadow root.",
      cause,
    });
  }
};

/**
 * A framework-independent inspector for one Beacon, rendered in a shadow root
 * so host styles never leak in or out. It reads the Beacon's snapshots and
 * diagnostics and calls nothing but `check`, so it never starts a session,
 * never reads what the application has not reached, and never runs a command.
 * Raw values and provider handles stay hidden until asked for, and property
 * names like `token` or `cookie` are always replaced.
 *
 * @example
 * ```ts
 * const devtools = new BeaconDevtools({ beacon, initialIsOpen: false, maxEvents: 200 });
 *
 * devtools.mount(document.body.appendChild(document.createElement("div")));
 * ```
 */
export class BeaconDevtools {
  #beacon: Accessor<ObservedBeacon>;
  #setBeacon: Setter<ObservedBeacon>;
  #initialIsOpen: boolean;
  #log: EventLog;
  #dispose: (() => void) | null = null;

  constructor({
    beacon,
    initialIsOpen = false,
    maxEvents = DEFAULT_MAX_EVENTS,
  }: BeaconDevtoolsOptions) {
    const [currentBeacon, setBeacon] = createSignal(beacon);

    this.#beacon = currentBeacon;
    this.#setBeacon = setBeacon;
    this.#initialIsOpen = initialIsOpen;
    this.#log = new EventLog(maxEvents);
  }

  /**
   * Renders the panel into a shadow root of `element`, which must be an
   * element that can host one, such as a `div`, and starts recording. Mounting
   * again before `unmount()`, or into an element that cannot host a shadow
   * root, throws a `BeaconError`.
   *
   * @example
   * ```ts
   * devtools.mount(document.body.appendChild(document.createElement("div")));
   * ```
   */
  mount = (element: HTMLElement) => {
    if (this.#dispose !== null) {
      throw new BeaconError({
        code: "INVALID_CONFIGURATION",
        message: "Beacon devtools are already mounted. Call unmount() first.",
      });
    }

    const root = openRoot(element);

    this.#dispose = render(
      () =>
        createComponent(Devtools, {
          beacon: this.#beacon,
          initialIsOpen: this.#initialIsOpen,
          log: this.#log,
        }),
      root,
    );
  };

  /**
   * Removes the panel and stops recording. Recorded events survive until the
   * next mount, and unmounting twice does nothing.
   *
   * @example
   * ```ts
   * devtools.unmount();
   * ```
   */
  unmount = () => {
    if (this.#dispose === null) {
      return;
    }

    this.#dispose();
    this.#dispose = null;
  };

  /**
   * Points the inspector at another Beacon, for example after the application
   * replaced its own.
   *
   * @example
   * ```ts
   * devtools.setBeacon(nextBeacon);
   * ```
   */
  setBeacon = (beacon: ObservedBeacon) => {
    this.#setBeacon(() => beacon);
  };

  /**
   * Changes how many events are kept, clamped to 1 to 1000. The oldest beyond
   * the new limit are forgotten.
   *
   * @example
   * ```ts
   * devtools.setMaxEvents(500);
   * ```
   */
  setMaxEvents = (maxEvents: number) => {
    this.#log.setLimit(maxEvents);
  };
}
