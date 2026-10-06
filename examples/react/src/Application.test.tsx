import { createTestClock } from "@priemskiyyy/beacon/mock";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createReleaseLab } from "example-shared/lab/createReleaseLab";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { Application } from "src/Application";

class IntersectionObserverStub {
  observe() {}

  disconnect() {}
}

const labs: ReleaseLab[] = [];

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  cleanup();

  for (const lab of labs.splice(0)) {
    lab.dispose();
  }

  vi.unstubAllGlobals();
});

// Lets every queued promise continuation run; time itself is the test clock's.
const settle = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      }),
  );

const renderApplication = async () => {
  const lab = createReleaseLab({ clock: createTestClock({ now: 1_000_000 }) });

  labs.push(lab);
  render(<Application lab={lab} />);
  await settle();

  return lab;
};

const fact = (term: string) => screen.getByLabelText(term);

const banner = () => screen.getByRole("region", { name: "Update banner" });

const press = async (name: string, scope: HTMLElement = document.body) => {
  fireEvent.click(within(scope).getByRole("button", { name }));
  await settle();
};

test("the provider starts the session and the startup check reports what runs", async () => {
  await renderApplication();

  expect(fact("Session").textContent).toBe("running");
  expect(fact("Running").textContent).toContain("Build 1 (web-build-1)");
  expect(fact("Support").textContent).toContain("supported");
  expect(fact("Observation").textContent).toContain("Nothing on offer");
  expect(
    within(banner()).getByRole("heading", { name: "You are up to date" }),
  ).toBeDefined();
});

test("a published build is offered after a check, and an unsaved draft blocks the update", async () => {
  await renderApplication();

  await press("Publish a newer build");
  await press("Check now");
  expect(
    within(banner()).getByRole("heading", { name: "Build 2 is available" }),
  ).toBeDefined();

  await press("Unsaved draft");
  await press("Update", banner());
  expect(
    screen.getByRole("status", { name: "Update outcome" }).textContent,
  ).toContain("Blocked: unsaved-draft");

  await press("Unsaved draft");
  await press("Update", banner());
  expect(
    screen.getByRole("status", { name: "Update outcome" }).textContent,
  ).toContain("Accepted, reload-requested");
  expect(fact("Running").textContent).toContain("Build 1");
});

test("booting the next document mounts a new tree over the same journal", async () => {
  await renderApplication();

  await press("Publish a newer build");
  await press("Check now");
  await press("Update", banner());
  await press("Boot the new build");

  expect(fact("Boot").textContent).toBe("boot-2");
  expect(fact("Running").textContent).toContain("Build 2 (web-build-2)");
  expect(fact("Outcome").textContent).toContain("target-running");
  expect(
    screen.getByRole("status", { name: "Update outcome" }).textContent,
  ).toBe("No update requested yet.");
});

test("a failing manifest keeps the offer and says the check is inconclusive", async () => {
  await renderApplication();

  await press("Publish a newer build");
  await press("Check now");
  await press("Fail the manifest");
  await press("Check now");

  expect(within(banner()).getByRole("alert").textContent).toContain(
    "Inconclusive: the last check failed (SOURCE_FAILED)",
  );
  expect(
    within(banner()).getByRole("heading", { name: "Build 2 is available" }),
  ).toBeDefined();
});

test("under StrictMode the startup check still finds the session the provider started", async () => {
  const lab = createReleaseLab({ clock: createTestClock({ now: 1_000_000 }) });

  labs.push(lab);
  render(
    <StrictMode>
      <Application lab={lab} />
    </StrictMode>,
  );
  await settle();

  expect(fact("Session").textContent).toBe("running");
  expect(fact("Check").textContent).toContain("Succeeded");
});
