import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const WIDTHS = [375, 1280];

// The release service answers at once, so a scenario waits for what the page shows and never for a delay.
const LAB = "/?latency=0";

const fact = (page: Page, term: string) =>
  page.getByLabel(term, { exact: true });

const button = (scope: Locator | Page, name: string) =>
  scope.getByRole("button", { name, exact: true });

const banner = (page: Page) =>
  page.getByRole("region", { name: "Update banner" });

const outcome = (page: Page) =>
  page.getByRole("status", { name: "Update outcome" });

const timeline = (page: Page) =>
  page.getByRole("list", { name: "Timeline entries" });

const open = async (page: Page, width = 1280) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto(LAB);
  await expect(fact(page, "Session")).toHaveText("running");
  await expect(fact(page, "Check")).toContainText("Succeeded");

  return errors;
};

const publishAndCheck = async (page: Page) => {
  await button(page, "Publish a newer build").click();
  await button(page, "Check now").click();
  await expect(fact(page, "Observation")).toContainText("On offer: Build 2");
};

for (const width of WIDTHS) {
  test(`a real page load reaches a checked, supported state without errors or horizontal scroll at ${width}px`, async ({
    page,
  }) => {
    const errors = await open(page, width);

    await expect(fact(page, "Running")).toContainText("Build 1 (web-build-1)");
    await expect(fact(page, "Observation")).toContainText(
      "Nothing on offer: the service names the build that runs",
    );
    await expect(fact(page, "Support")).toContainText("supported");
    await expect(fact(page, "Journal")).toHaveText("ready");
    await expect(
      banner(page).getByRole("heading", { name: "You are up to date" }),
    ).toBeVisible();
    await expect(outcome(page)).toHaveText("No update requested yet.");
    await expect(timeline(page)).toContainText(
      "A new document boots and runs build 1",
    );
    await expect(timeline(page)).toContainText("Read accepted (attempt 1)");

    const scrolls = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(scrolls).toBe(false);
    expect(errors).toEqual([]);
  });
}

test("a published build is offered once it is checked, and what runs does not change", async ({
  page,
}) => {
  await open(page);

  await button(page, "Publish a newer build").click();

  // The service changed; nothing has asked it yet, so nothing is on offer.
  await expect(fact(page, "Observation")).toContainText("Nothing on offer");

  await button(page, "Check now").click();
  await expect(
    banner(page).getByRole("heading", { name: "Build 2 is available" }),
  ).toBeVisible();
  await expect(fact(page, "Observation")).toContainText(
    "On offer: Build 2 (web-build-2)",
  );
  await expect(fact(page, "Running")).toContainText("Build 1 (web-build-1)");
  await expect(button(banner(page), "Update")).toBeVisible();
});

test("an update while the draft has unsaved changes is blocked, and works once it is saved", async ({
  page,
}) => {
  await open(page);
  await publishAndCheck(page);

  await button(page, "Unsaved draft").click();
  await button(banner(page), "Update").click();
  await expect(outcome(page)).toContainText("Blocked: unsaved-draft");
  await expect(fact(page, "Operation")).toHaveText("idle");
  await expect(fact(page, "Draft")).toHaveText("unsaved changes");

  await button(page, "Unsaved draft").click();
  await button(banner(page), "Update").click();
  await expect(outcome(page)).toContainText("Accepted, reload-requested");
  await expect(fact(page, "Operation")).toContainText("indeterminate");
  await expect(fact(page, "Draft")).toHaveText("locked by the reload");

  // A request is not an installation: the same build still runs.
  await expect(fact(page, "Running")).toContainText("Build 1 (web-build-1)");
});

test("an unsupported build shows the forced state and the route that satisfies it", async ({
  page,
}) => {
  await open(page);

  await button(page, "Publish a required build").click();
  await button(page, "Check now").click();

  await expect(
    banner(page).getByRole("heading", {
      name: "This build is no longer supported",
    }),
  ).toBeVisible();
  await expect(fact(page, "Support")).toContainText(
    "unsupported: below-minimum",
  );
  await expect(fact(page, "Remediation")).toHaveText(
    "web required, usable now",
  );

  await button(banner(page), "Update").click();
  await expect(outcome(page)).toContainText("Accepted, reload-requested");
  await button(page, "Boot the new build").click();

  await expect(fact(page, "Support")).toContainText("supported");
  await expect(
    banner(page).getByRole("heading", { name: "You are up to date" }),
  ).toBeVisible();
});

test("an ended build with nothing to update to is shown as it is, with no usable route", async ({
  page,
}) => {
  await open(page);

  await button(page, "End the running build").click();
  await button(page, "Check now").click();

  await expect(
    banner(page).getByRole("heading", {
      name: "This build is no longer supported",
    }),
  ).toBeVisible();
  await expect(banner(page)).toContainText("No update is usable yet");
  await expect(fact(page, "Remediation")).toHaveText(
    "web required, nothing usable yet",
  );
  await expect(button(banner(page), "Update")).toHaveCount(0);
});

test("a failing manifest keeps the previous decision and says the answer is inconclusive", async ({
  page,
}) => {
  await open(page);
  await publishAndCheck(page);

  await button(page, "Fail the manifest").click();
  await button(page, "Check now").click();

  await expect(fact(page, "Check")).toContainText("SOURCE_FAILED");
  await expect(banner(page).getByRole("alert")).toContainText(
    "Inconclusive: the last check failed (SOURCE_FAILED)",
  );

  // What was accepted stays, and so does the verdict of the policy.
  await expect(
    banner(page).getByRole("heading", { name: "Build 2 is available" }),
  ).toBeVisible();
  await expect(fact(page, "Observation")).toContainText("On offer: Build 2");
  await expect(fact(page, "Support")).toContainText("supported");

  await button(page, "Fail the manifest").click();
  await button(page, "Check now").click();
  await expect(fact(page, "Check")).toContainText("Succeeded");
  await expect(banner(page).getByRole("alert")).toHaveCount(0);
});

test("a document that boots while the manifest fails knows nothing and does not guess", async ({
  page,
}) => {
  await open(page);

  await button(page, "Fail the manifest").click();
  await button(page, "Boot the new build").click();

  await expect(fact(page, "Check")).toContainText("SOURCE_FAILED");
  await expect(fact(page, "Observation")).toContainText(
    "Unknown: nothing has been accepted yet",
  );
  await expect(fact(page, "Support")).toContainText("unknown");
  await expect(
    banner(page).getByRole("heading", { name: "Not checked yet" }),
  ).toBeVisible();
  await expect(banner(page).getByRole("alert")).toContainText(
    "Beacon cannot say whether a newer build exists",
  );
});

test("a slow manifest keeps the check waiting until it is answered", async ({
  page,
}) => {
  await open(page);

  await button(page, "Slow manifest").click();
  await button(page, "Check now").click();

  await expect(fact(page, "Check")).toContainText("Checking");
  await expect(fact(page, "Reads in flight")).toHaveText("1");

  await button(page, "Answer held read").click();
  await expect(fact(page, "Check")).toContainText("Succeeded");
  await expect(fact(page, "Reads in flight")).toHaveText("0");
});

test("a held read that is never answered fails the check at its deadline", async ({
  page,
}) => {
  await open(page);

  await button(page, "Slow manifest").click();
  await button(page, "Check now").click();
  await expect(fact(page, "Check")).toContainText("Checking");

  await button(page, "Skip 10 seconds").click();
  await expect(fact(page, "Check")).toContainText("SOURCE_TIMEOUT");
  await expect(fact(page, "Reads in flight")).toHaveText("0");
});

test("an expired answer is still shown, marked expired, and an update with its offer is refused", async ({
  page,
}) => {
  await open(page);
  await publishAndCheck(page);

  await button(page, "Expire the answer").click();
  await expect(fact(page, "Evidence")).toContainText("expired");
  await expect(banner(page)).toContainText("This answer expired");
  await expect(fact(page, "Support")).toContainText(
    "unknown: the accepted policy lapsed",
  );
  await expect(fact(page, "Observation")).toContainText("On offer: Build 2");

  await button(banner(page), "Update").click();
  await expect(outcome(page)).toContainText("Stale, expired");

  await button(banner(page), "Check again").click();
  await expect(fact(page, "Evidence")).toContainText("fresh");
  await expect(fact(page, "Support")).toContainText("supported");
});

test("a reload requested from the banner is followed by a boot whose journal shows the completed intent", async ({
  page,
}) => {
  await open(page);
  await publishAndCheck(page);

  await button(banner(page), "Update").click();
  await expect(outcome(page)).toContainText("Accepted, reload-requested");
  await expect(banner(page)).toContainText("the navigation has not happened");

  // Nothing new was observed in this boot, so the journal cannot say more yet.
  await expect(fact(page, "Outcome")).toContainText("same-boot");

  await button(page, "Boot the new build").click();

  await expect(page.getByText("document 2", { exact: true })).toBeVisible();
  await expect(fact(page, "Boot")).toHaveText("boot-2");
  await expect(fact(page, "Running")).toContainText("Build 2 (web-build-2)");
  await expect(fact(page, "Latest intent")).toHaveText(
    "reload on web from boot-1, aimed at web-build-2",
  );
  await expect(fact(page, "Outcome")).toContainText("target-running");
  await expect(fact(page, "Unreached boots")).toHaveText("0");
  await expect(
    banner(page).getByRole("heading", { name: "You are up to date" }),
  ).toBeVisible();
  await expect(timeline(page)).toContainText(
    "A new document boots and runs build 2",
  );
  await expect(timeline(page)).toContainText("target-running");
});

test("a build published after the offer is what boots, and the journal says it is a different target", async ({
  page,
}) => {
  await open(page);
  await publishAndCheck(page);

  await button(page, "Publish a newer build").click();
  await button(banner(page), "Update").click();
  await expect(outcome(page)).toContainText("Accepted, reload-requested");
  await button(page, "Boot the new build").click();

  await expect(fact(page, "Running")).toContainText("Build 3 (web-build-3)");
  await expect(fact(page, "Outcome")).toContainText("different-target");
});

test("a lagging deployment leaves the target unreached until the attempt budget is spent", async ({
  page,
}) => {
  await open(page);

  await button(page, "Deployment lags").click();
  await publishAndCheck(page);
  await button(banner(page), "Update").click();
  await button(page, "Boot the new build").click();

  await expect(fact(page, "Running")).toContainText("Build 1 (web-build-1)");
  await expect(fact(page, "Outcome")).toContainText("target-not-running");
  await expect(fact(page, "Unreached boots")).toHaveText("1");
  await expect(fact(page, "Observation")).toContainText("On offer: Build 2");

  await button(banner(page), "Update").click();
  await button(page, "Boot the new build").click();

  await expect(fact(page, "Unreached boots")).toContainText("2");
  await expect(fact(page, "Unreached boots")).toContainText("budget spent");
});

test("continuing in this build releases a reload that never navigated", async ({
  page,
}) => {
  await open(page);
  await publishAndCheck(page);

  await button(banner(page), "Update").click();
  await expect(fact(page, "Operation")).toContainText("indeterminate");

  // Nothing else may start while a reload is unresolved.
  await button(banner(page), "Update").click();
  await expect(outcome(page)).toContainText("operation-indeterminate");

  await button(banner(page), "Continue in this build").click();
  await expect(fact(page, "Operation")).toHaveText("idle");
  await expect(fact(page, "Draft")).toHaveText("saved");
});

test("reset starts the lab again in a new document with an empty journal", async ({
  page,
}) => {
  await open(page);
  await publishAndCheck(page);
  await button(banner(page), "Update").click();
  await button(page, "Boot the new build").click();
  await expect(fact(page, "Outcome")).toContainText("target-running");

  await button(page, "Reset demo").click();

  await expect(fact(page, "Running")).toContainText("Build 1 (web-build-1)");
  await expect(fact(page, "Outcome")).toHaveText("nothing to reconcile");
  await expect(fact(page, "Deployed")).toHaveText("1");
});
