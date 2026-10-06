import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The minimal web app of the getting-started page, in real Chromium. It is built once, as build `a91b44e`, and the spec plays the deployment: it serves `/releases.json`, which a release writes, and it serves the built script with the build id of the latest deploy, which is what a reload after a deploy loads.
const BUILT = "a91b44e";
const NEXT = "c0ffee1";

type Deployment = { manifest: string; script: string };

const open = async (page: Page, deployment: Deployment) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/releases.json", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        routes: {
          web: {
            kind: "target",
            release: { identity: deployment.manifest },
          },
        },
      },
      headers: { "cache-control": "no-cache" },
    }),
  );
  await page.route("**/assets/*.js", async (route) => {
    const response = await route.fetch();
    const script = await response.text();

    await route.fulfill({
      response,
      body: script.replaceAll(BUILT, deployment.script),
    });
  });

  const answered = page.waitForResponse("**/releases.json");

  await page.goto("/");
  await answered;

  return errors;
};

// A check that finds nothing shows nothing, so the absence of a banner is only believed after the answer has had its time.
const settled = (page: Page) => page.waitForTimeout(300);

const banner = (page: Page) => page.getByText("A new version is ready.");

test("no banner while the manifest names the build that runs", async ({
  page,
}) => {
  const errors = await open(page, { manifest: BUILT, script: BUILT });

  await expect(page.getByText(`Build ${BUILT}`)).toBeVisible();
  await settled(page);
  await expect(banner(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test("a banner when the manifest names another build", async ({ page }) => {
  const errors = await open(page, { manifest: NEXT, script: BUILT });

  await expect(banner(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a note that is not saved blocks the update, and once it is saved the page reloads into the new build", async ({
  page,
}) => {
  const deployment = { manifest: NEXT, script: BUILT };

  await open(page, deployment);
  await expect(banner(page)).toBeVisible();

  // What a document that is still alive has and a new one does not.
  await page.evaluate("window.sentinel = true");
  await page.getByLabel("Note").fill("Buy milk");
  await page.getByRole("button", { name: "Update" }).click();

  await expect(page.getByText("Save your note, then update.")).toBeVisible();
  expect(await page.evaluate("window.sentinel")).toBe(true);

  // The deploy has finished: the next document loads the new build.
  deployment.script = NEXT;
  await page.getByRole("button", { name: "Save" }).click();

  const loaded = page.waitForEvent("load");

  await page.getByRole("button", { name: "Update" }).click();
  await loaded;

  expect(await page.evaluate("window.sentinel")).toBeUndefined();
  await expect(page.getByText(`Build ${NEXT}`)).toBeVisible();
  await settled(page);
  await expect(banner(page)).toBeHidden();
});

test("a deploy while the tab is open is found when the network comes back", async ({
  context,
  page,
}) => {
  const deployment = { manifest: BUILT, script: BUILT };

  await open(page, deployment);
  await settled(page);
  await expect(banner(page)).toBeHidden();

  deployment.manifest = NEXT;
  await context.setOffline(true);
  await context.setOffline(false);

  // The gate holds two checks 5 seconds apart, so the check for the reconnect waits for the startup check's window to pass.
  await expect(banner(page)).toBeVisible({ timeout: 15_000 });
});
