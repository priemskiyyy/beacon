import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: { src: fileURLToPath(new URL("./src", import.meta.url)) },
    // The workspace links Beacon's binding with its own React; the page must render with one.
    dedupe: ["react", "react-dom"],
  },
});
