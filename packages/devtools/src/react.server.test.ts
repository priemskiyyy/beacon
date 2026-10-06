// @vitest-environment node
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { createLabBeacon } from "src/beacon.fixture";
import { BeaconDevtools } from "src/react";
import { spyOnBeacon } from "src/spyOnBeacon.fixture";

test("on a server the wrapper prints only its empty host element and observes, reads and starts nothing", () => {
  const { beacon, mock, commands } = createLabBeacon();
  const spy = spyOnBeacon(beacon);

  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");

  const html = renderToString(
    createElement(
      BeaconProvider,
      { beacon: spy.beacon },
      createElement(BeaconDevtools, { initialIsOpen: true }),
    ),
  );

  expect(html).toBe('<div data-beacon-devtools=""></div>');
  expect(spy.subscriptions()).toBe(0);
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
  expect(commands).toEqual({ reloads: 0, prefetches: 0, downloads: 0 });
});
