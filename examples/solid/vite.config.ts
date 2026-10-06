import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: {
    alias: { src: fileURLToPath(new URL("./src", import.meta.url)) },
    // The workspace links Beacon's binding with its own Solid; the page must run with one.
    dedupe: ["solid-js"],
  },
});
