import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { rolldown } from "rolldown";

// Each built entry, bundled as a consumer would get it: minified, peers
// external, and the gzip size is what a budget reviews. An adapter is measured
// on its own, since it imports the core as a peer.
const packages = fileURLToPath(new URL("../packages/", import.meta.url));

const ENTRIES = [
  { name: "core", files: ["core/dist/index.js"], budget: 18 * 1024 },
  {
    name: "core + versions",
    files: ["core/dist/index.js", "core/dist/versions.js"],
    budget: 19 * 1024,
  },
  { name: "http", files: ["adapters/http/dist/index.js"], budget: 4 * 1024 },
  {
    name: "browser",
    files: ["adapters/browser/dist/index.js"],
    budget: 1024,
  },
  {
    name: "service-worker",
    files: ["adapters/service-worker/dist/index.js"],
    budget: 2 * 1024,
  },
  { name: "expo", files: ["adapters/expo/dist/index.js"], budget: 2 * 1024 },
  {
    name: "google-play",
    files: ["adapters/google-play/dist/index.js"],
    budget: 2.5 * 1024,
  },
  {
    name: "app-store",
    files: ["adapters/app-store/dist/index.js"],
    budget: 2 * 1024,
  },
  { name: "react", files: ["react/dist/index.js"], budget: 1.5 * 1024 },
  { name: "solid", files: ["solid/dist/index.js"], budget: 1.5 * 1024 },
  { name: "vue", files: ["vue/dist/index.js"], budget: 1.5 * 1024 },
  // The inspector bundles its own Solid runtime, so it is measured and not budgeted; its wrapper is a few lines.
  { name: "devtools", files: ["devtools/dist/index.js"], budget: null },
  {
    name: "devtools react",
    files: ["devtools/dist/react.js"],
    budget: 512,
  },
  { name: "mock", files: ["core/dist/mock.js"], budget: null },
  { name: "testing", files: ["core/dist/testing.js"], budget: null },
];

const measure = async (files) => {
  const bundle = await rolldown({
    input: files.map((file) => `${packages}${file}`),
    external: [
      /^@priemskiyyy\/beacon(\/|$)/,
      /^@priemskiyyy\/beacon-(devtools|react)(\/|$)/,
      "react",
      "react-dom",
      "solid-js",
      "vue",
      /^svelte(\/|$)/,
      "vitest",
    ],
    logLevel: "silent",
  });

  const getCode = async (minify) => {
    const { output } = await bundle.generate({ format: "esm", minify });

    return output
      .flatMap((chunk) => (chunk.type === "chunk" ? [chunk.code] : []))
      .join("\n");
  };

  const raw = await getCode(false);
  const minified = await getCode(true);

  await bundle.close();

  return {
    raw: Buffer.byteLength(raw),
    minified: Buffer.byteLength(minified),
    gzip: gzipSync(minified).byteLength,
  };
};

const rows = [];

for (const { name, files, budget } of ENTRIES) {
  const size = await measure(files);

  rows.push({ entry: name, ...size, "gzip budget": budget ?? "none" });

  if (budget !== null) {
    assert(
      size.gzip <= budget,
      `${name} is ${size.gzip} B gzip, over its ${budget} B budget.`,
    );
  }
}

console.table(rows);
