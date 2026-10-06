import { describe, expect, test, vi } from "vitest";

import { listFailed, runCollected } from "src/testing/collectChecks.fixture";
import { testUpdateMechanism } from "src/testing/testUpdateMechanism";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";

vi.mock("vitest", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { collect } = await import("src/testing/collectChecks.fixture");

  return { ...actual, describe: collect.describe, test: collect.test };
});

const SUBJECT_CHECK = "it names the running subject its commands replace";

const createInert = () =>
  createUpdateMechanism({
    name: "inert",
    subject: "web",
    open: () => ({ native: {} }),
    commands: {},
  });

describe("a mechanism that keeps the contract passes every check", () => {
  test("one that names its subject", async () => {
    const outcomes = await runCollected(() => {
      testUpdateMechanism({
        name: "inert",
        create: () => ({ mechanism: createInert() }),
      });
    });

    expect(listFailed(outcomes)).toEqual([]);
    expect(outcomes[SUBJECT_CHECK]).toBe("passed");
  });
});

describe("a mechanism that breaks the contract fails the check that names it", () => {
  test("a mechanism of plain JavaScript that names no running subject", async () => {
    const outcomes = await runCollected(() => {
      testUpdateMechanism({
        name: "unnamed",
        create: () => ({
          mechanism: Object.assign(createInert(), { subject: "desktop" }),
        }),
      });
    });

    expect(listFailed(outcomes)).toEqual([SUBJECT_CHECK]);
  });
});
