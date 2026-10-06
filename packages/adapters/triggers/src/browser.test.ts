import { expect, test } from "vitest";

import * as browser from "src/browser";

test("the browser entry exports exactly its two triggers, which have the names of the React Native ones", () => {
  expect(Object.keys(browser).sort()).toEqual(["foreground", "reconnect"]);
});
