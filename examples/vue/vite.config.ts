import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { src: fileURLToPath(new URL("./src", import.meta.url)) },
    // The workspace links Beacon's binding with its own Vue; the page must render with one.
    dedupe: ["vue"],
  },
});
