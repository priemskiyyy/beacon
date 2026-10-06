import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "vitest";

// What an application imports is each package's built entry. Loading it, where
// Hermes' missing globals are gone and there is no document, neither throws nor
// reads a global that only a browser has.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ENTRIES = [
  "packages/core/dist/index.js",
  "packages/core/dist/adapter.js",
  "packages/core/dist/versions.js",
  "packages/core/dist/mock.js",
  "packages/core/dist/triggers.js",
  "packages/core/dist/triggers-browser.js",
  "packages/adapters/http/dist/index.js",
  "packages/adapters/expo/dist/index.js",
  "packages/adapters/google-play/dist/index.js",
  "packages/adapters/app-store/dist/index.js",
  "packages/adapters/firebase-remote-config/dist/index.js",
  "packages/adapters/code-push/dist/index.js",
  "packages/adapters/device-info/dist/index.js",
];

const BROWSER_GLOBALS = [
  "document",
  "location",
  "localStorage",
  "sessionStorage",
  "requestAnimationFrame",
  "HTMLElement",
  "Element",
  "Node",
];

test.each(ENTRIES)(
  "%s loads, and reads no browser global as it does",
  async (entry) => {
    const reads: string[] = [];
    const originals = new Map<string, PropertyDescriptor | undefined>();

    for (const name of BROWSER_GLOBALS) {
      const original = Object.getOwnPropertyDescriptor(globalThis, name);

      originals.set(name, original);
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get: () => {
          reads.push(`${name} ${new Error(name).stack}`);

          return original?.value;
        },
      });
    }

    try {
      const api = await import(
        /* @vite-ignore */ `${pathToFileURL(path.join(ROOT, entry)).href}?hermes`
      );

      expect(Object.keys(api).length).toBeGreaterThan(0);
    } finally {
      for (const [name, original] of originals) {
        if (original === undefined) {
          Reflect.deleteProperty(globalThis, name);

          continue;
        }

        Object.defineProperty(globalThis, name, original);
      }
    }

    expect(reads.filter((read) => read.includes("/dist/"))).toEqual([]);
  },
);
