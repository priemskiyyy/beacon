import { expect, test } from "vitest";

import { styles } from "src/styles";

test("the host's inherited styles stop at the shadow boundary, before anything of the panel's own is set", () => {
  const host = /:host\s*\{([^}]*)\}/.exec(styles)?.[1];

  // A shadow root shields the panel from the host's selectors, but not from what the host element passes down by inheritance.
  expect(host?.trim().startsWith("all: initial;")).toBe(true);
  expect(host).toContain("direction: ltr");
  expect(host).toContain("font: var(--font)");
});
