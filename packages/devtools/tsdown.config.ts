import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

const wrapper: UserConfig = {
  format: ["esm"],
  target: "es2022",
  platform: "neutral",
  dts: true,
  clean: false,
  sourcemap: true,
  // The wrapper imports the inspector by its package name, so it shares the one copy of it.
  deps: { neverBundle: ["@priemskiyyy/beacon-devtools"] },
};

export default defineConfig([
  // Vite builds the inspector bundle first, so this entry only adds its declarations.
  {
    entry: { index: "src/index.ts" },
    platform: "neutral",
    dts: { emitDtsOnly: true },
    clean: false,
  },
  // A top-level banner also reaches the declarations, where the directive is TS1036 for consumers without skipLibCheck.
  {
    ...wrapper,
    entry: { react: "src/react.ts" },
    outputOptions: { banner: '"use client";' },
  },
]);
