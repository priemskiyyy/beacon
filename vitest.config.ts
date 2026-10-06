import { fileURLToPath } from "node:url";
import vue from "/home/user/beacon/examples/vue/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { defineConfig } from "vitest/config";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    dedupe: ["vue"],
    alias: [
      { find: /^src\//, replacement: at("./src/") },
      { find: "@priemskiyyy/beacon-vue", replacement: at("../../../packages/vue/dist/index.js") },
      { find: "@priemskiyyy/beacon/mock", replacement: at("../../../packages/core/dist/mock.js") },
      { find: "@priemskiyyy/beacon-browser", replacement: at("../../../packages/adapters/browser/dist/index.js") },
      { find: /^@priemskiyyy\/beacon$/, replacement: at("../../../packages/core/dist/index.js") },
    ],
  },
  test: { environment: "jsdom", include: ["src/**/*.test.ts"], root: at("./") },
});
