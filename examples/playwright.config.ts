import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

const preview = (name: string, port: number) => ({
  command: `pnpm --filter example-${name} build && pnpm --filter example-${name} exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
  cwd: "..",
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer: process.env.CI === undefined,
  timeout: 120_000,
});

const servers = [
  preview("react", 4490),
  preview("vue", 4492),
  preview("solid", 4493),
  preview("svelte", 4494),
  {
    command:
      "pnpm --filter example-expo build && pnpm --filter example-react exec vite preview --outDir ../expo/dist --host 127.0.0.1 --port 4491 --strictPort",
    cwd: "..",
    url: "http://127.0.0.1:4491",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 180_000,
  },
];

// Real Chromium against the built examples. A device, a store and a real release service stay manual exercises.
export default defineConfig({
  testDir: ".",
  outputDir: "../.artifacts/example-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4490",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(executablePath === undefined
      ? {}
      : { launchOptions: { executablePath } }),
  },
  // The same scenarios run against every web binding: each app answers to the same names, roles and labels.
  projects: [
    { name: "react", testMatch: "lab.spec.ts" },
    {
      name: "vue",
      testMatch: "lab.spec.ts",
      use: { baseURL: "http://127.0.0.1:4492" },
    },
    {
      name: "solid",
      testMatch: "lab.spec.ts",
      use: { baseURL: "http://127.0.0.1:4493" },
    },
    {
      name: "svelte",
      testMatch: "lab.spec.ts",
      use: { baseURL: "http://127.0.0.1:4494" },
    },
    { name: "expo", testMatch: "expo.spec.ts" },
  ],
  // A run of one app starts its own preview and sets this, so it builds nothing else.
  webServer: process.env.EXAMPLE_SERVERS_STARTED === undefined ? servers : [],
});
