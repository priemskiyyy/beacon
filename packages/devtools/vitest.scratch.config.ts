import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Scratch copy of the root devtools project, used while the root config is swapped by another agent.
export default defineConfig({
  plugins: [solid({ solid: { delegateEvents: false } })],
  resolve: {
    alias: {
      src: at("./src"),
      "@priemskiyyy/beacon-devtools": at("./src/index.ts"),
    },
    conditions: ["development", "browser"],
    dedupe: ["react", "react-dom", "solid-js"],
  },
  test: {
    globals: false,
    restoreMocks: true,
    name: "devtools",
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    server: { deps: { inline: [/solid-js/] } },
  },
});
