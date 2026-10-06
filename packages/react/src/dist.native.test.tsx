import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "vitest";

// The built entry is what an application imports. Loading it reads no global that only a browser has.
const DOM_GLOBALS = [
  "window",
  "document",
  "navigator",
  "self",
  "location",
  "localStorage",
  "sessionStorage",
  "requestAnimationFrame",
  "HTMLElement",
  "Element",
  "Node",
];

const dist = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist/index.js"),
).href;

test("importing the built package reads no DOM global, in an environment with no document", async () => {
  const reads: string[] = [];
  const originals = new Map<string, PropertyDescriptor | undefined>();

  for (const name of DOM_GLOBALS) {
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
    const api = await import(/* @vite-ignore */ `${dist}?no-dom`);

    expect(Object.keys(api).sort()).toEqual([
      "BeaconProvider",
      "useBeacon",
      "useDisruption",
      "useObservable",
      "useRoute",
      "useRunning",
      "useStatus",
      "useSupport",
      "useTransitions",
    ]);
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
});
