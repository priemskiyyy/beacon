import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The release service answers at once, so a scenario waits for what the page shows and never for a delay.
const EXPO = "http://127.0.0.1:4491/?latency=0";

const open = async (page: Page) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(EXPO);
  await expect(page.getByTestId("session")).toHaveText("running");
  await expect(page.getByTestId("check")).toContainText("Succeeded");

  return errors;
};

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test("the Expo web build runs the lab through the shared code and the React hooks", async ({
  page,
}) => {
  const errors = await open(page);

  await expect(page.getByTestId("running")).toContainText(
    "Build 1 (web-build-1)",
  );
  await expect(page.getByTestId("support")).toHaveText("supported");
  await expect(page.getByTestId("banner-headline")).toHaveText(
    "You are up to date",
  );
  await expect(page.getByTestId("runtime")).toContainText("web, ");
  await expect(page.getByTestId("journal")).toHaveText("ready");
  await expect(page.getByTestId("timeline")).toContainText(
    "A new document boots and runs build 1",
  );
  expect(errors).toEqual([]);
});

test("a published build is offered, blocked by an unsaved draft, and boots as the target after the reload", async ({
  page,
}) => {
  await open(page);

  await button(page, "Publish a newer build").click();
  await button(page, "Check now").click();
  await expect(page.getByTestId("banner-headline")).toHaveText(
    "Build 2 is available",
  );

  await button(page, "Unsaved draft").click();
  await button(page, "Update").click();
  await expect(page.getByTestId("outcome")).toContainText(
    "Blocked: unsaved-draft",
  );

  await button(page, "Unsaved draft").click();
  await button(page, "Update").click();
  await expect(page.getByTestId("outcome")).toContainText(
    "Accepted, reload-requested",
  );
  await expect(page.getByTestId("operation")).toHaveText("indeterminate");
  await expect(page.getByTestId("running")).toContainText("Build 1");

  await button(page, "Boot the new build").click();

  await expect(page.getByTestId("running")).toContainText(
    "Build 2 (web-build-2)",
  );
  await expect(page.getByTestId("reconciliation")).toHaveText("target-running");
  await expect(page.getByTestId("boot")).toHaveText("boot-2");
});

test("a required build shows the forced state, and a failing manifest keeps what was accepted", async ({
  page,
}) => {
  await open(page);

  await button(page, "Publish a required build").click();
  await button(page, "Check now").click();
  await expect(page.getByTestId("banner-headline")).toHaveText(
    "This build is no longer supported",
  );
  await expect(page.getByTestId("support")).toContainText(
    "unsupported: below-minimum",
  );

  await button(page, "Fail the manifest").click();
  await button(page, "Check now").click();
  await expect(page.getByTestId("check")).toContainText("SOURCE_FAILED");
  await expect(page.getByTestId("banner-inconclusive")).toContainText(
    "Inconclusive",
  );
  await expect(page.getByTestId("banner-headline")).toHaveText(
    "This build is no longer supported",
  );
});
