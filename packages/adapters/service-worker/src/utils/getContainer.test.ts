import { expect, onTestFinished, test, vi } from "vitest";

import { fakeContainer } from "src/fakeWorkers.fixture";
import { getContainer } from "src/utils/getContainer";

test("getContainer is the container of the page's navigator", () => {
  const container = fakeContainer(() => undefined);

  vi.stubGlobal("navigator", { serviceWorker: container });
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });

  expect(getContainer()).toBe(container);
});

test("getContainer has none where the navigator offers no service workers, as in an insecure context", () => {
  vi.stubGlobal("navigator", {});
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });

  expect(getContainer()).toBeNull();
});

test("getContainer has none where there is no navigator, as in a server render", () => {
  vi.stubGlobal("navigator", undefined);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });

  expect(getContainer()).toBeNull();
});
