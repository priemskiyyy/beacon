import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: { src: fileURLToPath(new URL("./src", import.meta.url)) },
    // The workspace links Beacon's binding with its own Svelte; the page must render with one.
    dedupe: ["svelte"],
  },
});
