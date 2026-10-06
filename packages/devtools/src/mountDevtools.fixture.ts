import { within } from "@testing-library/dom";

import { BeaconDevtools } from "src/BeaconDevtools";
import type { BeaconDevtoolsOptions } from "src/types/BeaconDevtoolsOptions";

// Lets every queued promise continuation and microtask run before the test goes on.
export const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/** Mounts the inspector into a fresh host of the document, with queries scoped to its shadow root. */
export const mountDevtools = (options: BeaconDevtoolsOptions) => {
  const host = document.body.appendChild(document.createElement("div"));
  const devtools = new BeaconDevtools(options);

  devtools.mount(host);

  // Queries need an element; the shadow root's only child is the application root.
  const view = () => {
    const root = host.shadowRoot?.firstElementChild;

    if (!(root instanceof HTMLElement)) {
      throw new Error("Expected the devtools root inside the shadow root");
    }

    return within(root);
  };

  const text = () => host.shadowRoot?.textContent ?? "";

  return { host, devtools, view, text };
};
