import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    adapter: "src/adapter.ts",
    versions: "src/versions.ts",
    mock: "src/mock.ts",
    testing: "src/testing.ts",
    triggers: "src/triggers.ts",
    "triggers-browser": "src/triggers/browser.ts",
  },
  format: ["esm"],
  target: "es2022",
  platform: "neutral",
  dts: true,
  clean: true,
  sourcemap: true,
});
