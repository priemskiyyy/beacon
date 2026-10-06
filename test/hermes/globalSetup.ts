import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    /** Where React Native's own URL and URLSearchParams were compiled to, as ES modules. */
    hermesLibraries: string;
  }
}

// What a React Native app has for `URL` and `URLSearchParams` is the Flow
// source in react-native/Libraries/Blob. It is compiled once per run with the
// Babel that React Native itself resolves, so the environment under test is
// the library's and not a copy of it.
const LIBRARIES = ["URL", "URLSearchParams"];

export default function setup(project: TestProject) {
  const reactNative = createRequire(import.meta.url).resolve(
    "react-native/package.json",
  );

  const fromReactNative = createRequire(reactNative);
  const babel = fromReactNative("@babel/core");

  const directory = mkdtempSync(path.join(tmpdir(), "beacon-hermes-"));

  mkdirSync(directory, { recursive: true });

  for (const name of LIBRARIES) {
    const source = readFileSync(
      path.join(path.dirname(reactNative), "Libraries/Blob", `${name}.js`),
      "utf8",
    )
      // The blob module is native, and `URL.createObjectURL` is the only thing that reads it.
      .replace(
        "import NativeBlobModule from './NativeBlobModule';",
        "const NativeBlobModule = null;",
      )
      .replace("import type Blob from './Blob';", "")
      .replace("'./URLSearchParams'", "'./URLSearchParams.mjs'");

    const { code } = babel.transformSync(source, {
      filename: `${name}.js`,
      babelrc: false,
      configFile: false,
      plugins: [
        fromReactNative.resolve("@babel/plugin-transform-flow-strip-types"),
      ],
      parserOpts: { plugins: ["flow"] },
    });

    writeFileSync(path.join(directory, `${name}.mjs`), code);
  }

  project.provide("hermesLibraries", directory);

  return () => {
    rmSync(directory, { recursive: true, force: true });
  };
}
