import assert from "node:assert/strict";
import { ESLint } from "eslint";

const eslint = new ESLint();

const CORE = "packages/core/src/utils/lint-probe.ts";
const CLOCK = "packages/core/src/utils/internal/clock/createSystemClock.ts";
const MOCK = "packages/core/src/mock/lint-probe.ts";
const SETTLE = "packages/core/src/mock/settle.ts";
const SUITE = "packages/core/src/testing/lint-probe.ts";
const ADAPTER = "packages/adapters/http/src/lint-probe.ts";
const NATIVE_ADAPTER = "packages/adapters/expo/src/lint-probe.ts";
const TRIGGERS = "packages/core/src/triggers/lint-probe.ts";
const TRIGGERS_BROWSER = "packages/core/src/triggers/browser/lint-probe.ts";
const REACT = "packages/react/src/lint-probe.ts";
const SOLID = "packages/solid/src/lint-probe.ts";
const VUE = "packages/vue/src/lint-probe.ts";
const SVELTE = "packages/svelte/src/lint-probe.ts";
const TEST = "packages/core/src/utils/lint-probe.test.ts";
const DEVTOOLS = "packages/devtools/src/lint-probe.ts";
const DEVTOOLS_CLIPBOARD = "packages/devtools/src/hooks/useClipboard.ts";
const DEVTOOLS_REACT = "packages/devtools/src/react.ts";

const syntax = [
  ['import { value } from "./value";', "no-restricted-syntax"],
  ['import type { Value } from "../types";', "no-restricted-syntax"],
  ['const value = import("./value");', "no-restricted-syntax"],
  ['type Value = import("../value").Value;', "no-restricted-syntax"],
  [
    "const value = 1 as number;",
    "@typescript-eslint/consistent-type-assertions",
  ],
  ["const value = [1] as const;", "no-restricted-syntax"],
  [
    "// eslint-disable-next-line no-restricted-syntax\nconst value = [1] as const;",
    "no-restricted-syntax",
  ],
  ["/* eslint-disable */\nconst value = [1] as const;", "no-restricted-syntax"],
  ["const value = <number>1;", "no-restricted-syntax"],
  ["const value: string | null = null; value!;", "no-restricted-syntax"],
  ["enum State { Ready }", "no-restricted-syntax"],
  ["switch (1) { default: break; }", "no-restricted-syntax"],
  ["void Promise.resolve();", "no-restricted-syntax"],
  ["let value; value ??= 1;", "no-restricted-syntax"],
  ["let value = 0; value ||= 1;", "no-restricted-syntax"],
  ["let value = 0; value &&= 1;", "no-restricted-syntax"],
  ["type Value = { readonly key: string };", "no-restricted-syntax"],
  ["type Value = { readonly [key: string]: string };", "no-restricted-syntax"],
  ["class Value { readonly key = 1; }", "no-restricted-syntax"],
  [
    "class Value { constructor(readonly key: string) {} }",
    "no-restricted-syntax",
  ],
  [
    "type Value<T> = { readonly [K in keyof T]: T[K] };",
    "no-restricted-syntax",
  ],
  ["type Value = readonly string[];", "no-restricted-syntax"],
  ["type Value = Readonly<{ key: string }>;", "no-restricted-syntax"],
  ["type Value = ReadonlyArray<string>;", "no-restricted-syntax"],
  ['export * from "src/value";', "no-restricted-syntax"],
  [
    "declare const values: number[]; values.filter(Boolean).map(String);",
    "no-restricted-syntax",
  ],
  [
    "declare const values: number[]; values.map(String).filter(Boolean);",
    "no-restricted-syntax",
  ],
  [
    "export const pick = (flag: boolean) => {\n  return flag ? 1 : 2;\n};",
    "no-restricted-syntax",
  ],
  [
    "export const pick = (flag: boolean) => (flag ? 1 : 2);",
    "no-restricted-syntax",
  ],
  [
    "export const run = (flag: boolean) => {\n  console.log(0);\n\n  if (flag) {\n    console.log(1);\n  }\n};",
    "no-restricted-syntax",
  ],
  [
    "export const run = (flags: boolean[]) => {\n  for (const flag of flags) {\n    console.log(0);\n\n    if (flag) {\n      console.log(1);\n    }\n  }\n};",
    "no-restricted-syntax",
  ],
  [
    "declare const signal: { throwIfAborted: () => void }; signal.throwIfAborted();",
    "no-restricted-syntax",
  ],
  ["const stop = AbortSignal.abort();", "no-restricted-syntax"],
  ["const stop = AbortSignal.timeout(1_000);", "no-restricted-syntax"],
  [
    "declare const signal: { reason: string }; const reason = signal.reason;",
    "no-restricted-syntax",
  ],
  // Hermes V1 resolves undefined from an async arrow function whose parameter is not a plain name.
  [
    "export const run = async ({ scope }: { scope: string }) => scope;",
    "no-restricted-syntax",
  ],
  [
    "export const run = async (options: object = {}) => options;",
    "no-restricted-syntax",
  ],
  [
    "export const run = async ([first]: string[]) => first;",
    "no-restricted-syntax",
  ],
  [
    "export const run = async (...rest: string[]) => rest;",
    "no-restricted-syntax",
  ],
  [
    "declare const source: { removeAllListeners: () => void }; source.removeAllListeners();",
    "no-restricted-syntax",
  ],
  [
    "declare const sdk: { configure: (options: object) => void }; sdk.configure({});",
    "no-restricted-syntax",
  ],
  [
    "interface Value { key: string }",
    "@typescript-eslint/consistent-type-definitions",
  ],
  ["const value: any = 1;", "@typescript-eslint/no-explicit-any"],
  [
    'import { Value } from "src/value";\n\ntype Copy = Value;',
    "@typescript-eslint/consistent-type-imports",
  ],
  ["if (true) console.log(1);", "curly"],
  [
    "function value(flag) { if (flag) { return 1; } else { return 2; } }",
    "no-else-return",
  ],
  [
    "const first = 1;\nif (first) {\n  first;\n}",
    "padding-line-between-statements",
  ],
  [
    "function value() {\n  const first = 1;\n  return first;\n}",
    "padding-line-between-statements",
  ],
];

// The core is platform neutral and keeps time only through its clock; an
// adapter never imports its provider SDK at runtime.
const boundaries = [
  ['import { useState } from "react";', "no-restricted-imports", CORE],
  ['import { useState } from "react";', "no-restricted-imports", ADAPTER],
  ['import * as Updates from "expo-updates";', "no-restricted-imports", CORE],
  [
    'import * as Updates from "expo-updates";',
    "no-restricted-imports",
    NATIVE_ADAPTER,
  ],
  [
    'import { Workbox } from "workbox-window";',
    "no-restricted-imports",
    ADAPTER,
  ],
  [
    'import * as Application from "expo-application";',
    "no-restricted-imports",
    NATIVE_ADAPTER,
  ],
  [
    'import DeviceInfo from "react-native-device-info";',
    "no-restricted-imports",
    NATIVE_ADAPTER,
  ],
  [
    'import CodePush from "react-native-code-push";',
    "no-restricted-imports",
    NATIVE_ADAPTER,
  ],
  [
    'import CodePush from "@bravemobile/react-native-code-push";',
    "no-restricted-imports",
    NATIVE_ADAPTER,
  ],
  [
    'import remoteConfig from "@react-native-firebase/remote-config";',
    "no-restricted-imports",
    NATIVE_ADAPTER,
  ],
  [
    'import NetInfo from "@react-native-community/netinfo";',
    "no-restricted-imports",
    NATIVE_ADAPTER,
  ],
  [
    'import { getRemoteConfig } from "firebase/remote-config";',
    "no-restricted-imports",
    ADAPTER,
  ],
  // The triggers take AppState, NetInfo, a Pulse and a Reach condition as structural types, and never import them.
  [
    'import NetInfo from "@react-native-community/netinfo";',
    "no-restricted-imports",
    TRIGGERS,
  ],
  [
    'import { Pulse } from "@priemskiyyy/pulse";',
    "no-restricted-imports",
    TRIGGERS,
  ],
  [
    'import { Reach } from "@priemskiyyy/reach";',
    "no-restricted-imports",
    TRIGGERS,
  ],
  ["setTimeout(() => {}, 0);", "no-restricted-globals", TRIGGERS],
  ["const time = Date.now();", "no-restricted-syntax", TRIGGERS],
  ["const view = window;", "no-restricted-globals", TRIGGERS],
  // The browser triggers are the one part of the core that reads a window, and still only the Beacon's clock and no SDK.
  ["setTimeout(() => {}, 0);", "no-restricted-globals", TRIGGERS_BROWSER],
  ["const time = Date.now();", "no-restricted-syntax", TRIGGERS_BROWSER],
  [
    'import NetInfo from "@react-native-community/netinfo";',
    "no-restricted-imports",
    TRIGGERS_BROWSER,
  ],
  ['import { Platform } from "react-native";', "no-restricted-imports", REACT],
  ['import { createSignal } from "solid-js";', "no-restricted-imports", CORE],
  ['import { createSignal } from "solid-js";', "no-restricted-imports", REACT],
  ['import { createSignal } from "solid-js";', "no-restricted-imports", VUE],
  [
    'import { isServer } from "solid-js/web";',
    "no-restricted-imports",
    ADAPTER,
  ],
  ['import { ref } from "vue";', "no-restricted-imports", CORE],
  ['import { ref } from "vue";', "no-restricted-imports", SOLID],
  ['import { ref } from "@vue/reactivity";', "no-restricted-imports", REACT],
  ['import { onMount } from "svelte";', "no-restricted-imports", CORE],
  ['import { onMount } from "svelte";', "no-restricted-imports", REACT],
  ['import { writable } from "svelte/store";', "no-restricted-imports", VUE],
  ['import { ref } from "vue";', "no-restricted-imports", SVELTE],
  ['import { useState } from "react";', "no-restricted-imports", SOLID],
  ['import { useState } from "react";', "no-restricted-imports", SVELTE],
  ['import { Platform } from "react-native";', "no-restricted-imports", VUE],
  ["const time = Date.now();", "no-restricted-syntax", SOLID],
  ["setTimeout(() => {}, 0);", "no-restricted-globals", VUE],
  ["const time = Date.now();", "no-restricted-syntax", SVELTE],
  ['import { expect } from "vitest";', "no-restricted-imports", MOCK],
  ['import { useState } from "react";', "no-restricted-imports", SUITE],
  ["setTimeout(() => {}, 0);", "no-restricted-globals", SUITE],
  [
    'import { render } from "@testing-library/react";',
    "no-restricted-imports",
    CORE,
  ],
  ["setTimeout(() => {}, 0);", "no-restricted-globals", CORE],
  ["setInterval(() => {}, 1_000);", "no-restricted-globals", MOCK],
  ["setTimeout(() => {}, 0);", "no-restricted-globals", ADAPTER],
  ["const view = window;", "no-restricted-globals", CORE],
  ["const page = document;", "no-restricted-globals", CLOCK],
  ["const agent = navigator;", "no-restricted-globals", MOCK],
  ["const time = Date.now();", "no-restricted-syntax", SETTLE],
  ["const view = window;", "no-restricted-globals", SETTLE],
  ["const big = BigInt(1);", "no-restricted-globals", CORE],
  ["const big = BigInt(1);", "no-restricted-globals", ADAPTER],
  ["const copy = structuredClone({});", "no-restricted-globals", CORE],
  ["const decoder = new TextDecoder();", "no-restricted-globals", ADAPTER],
  ["const encoder = new TextEncoder();", "no-restricted-globals", CORE],
  // What Hermes and React Native lack, in every package a React Native app runs.
  ["const id = crypto.randomUUID();", "no-restricted-globals", CORE],
  ["const id = crypto.randomUUID();", "no-restricted-globals", ADAPTER],
  ["const id = crypto.randomUUID();", "no-restricted-globals", NATIVE_ADAPTER],
  ["const id = crypto.randomUUID();", "no-restricted-globals", REACT],
  ["const id = crypto.randomUUID();", "no-restricted-globals", CLOCK],
  [
    'const url = new URL("https://example.com");',
    "no-restricted-globals",
    CORE,
  ],
  [
    'const url = new URL("https://example.com");',
    "no-restricted-globals",
    NATIVE_ADAPTER,
  ],
  [
    'const query = new URLSearchParams("a=b");',
    "no-restricted-globals",
    ADAPTER,
  ],
  ["const bytes = Buffer.from([]);", "no-restricted-globals", CORE],
  ["const format = new Intl.DateTimeFormat();", "no-restricted-globals", CORE],
  [
    "const reference = new WeakRef({});",
    "no-restricted-globals",
    NATIVE_ADAPTER,
  ],
  ["const store = localStorage;", "no-restricted-globals", ADAPTER],
  ["const page = location;", "no-restricted-globals", NATIVE_ADAPTER],
  ["const view = window;", "no-restricted-globals", NATIVE_ADAPTER],
  ["const page = document;", "no-restricted-globals", REACT],
  [
    "const gate = Promise.withResolvers();",
    "no-restricted-syntax",
    NATIVE_ADAPTER,
  ],
  ["const gate = Promise.try(() => 1);", "no-restricted-syntax", CORE],
  [
    "const groups = Object.groupBy([1], (n) => n);",
    "no-restricted-syntax",
    REACT,
  ],
  [
    "declare const values: number[]; const sorted = values.toSorted();",
    "no-restricted-syntax",
    ADAPTER,
  ],
  [
    "const scope = { [Symbol.dispose]: () => {} };\nconst end = Symbol.dispose;",
    "no-restricted-syntax",
    CORE,
  ],
  [
    "declare const response: { body: { getReader: () => void } }; response.body.getReader();",
    "no-restricted-syntax",
    ADAPTER,
  ],
  [
    "export const run = async ({ scope }: { scope: string }) => scope;",
    "no-restricted-syntax",
    NATIVE_ADAPTER,
  ],
  [
    "export const run = async ({ scope }: { scope: string }) => scope;",
    "no-restricted-syntax",
    REACT,
  ],
  ["const time = Date.now();", "no-restricted-syntax", CORE],
  ["const time = new Date();", "no-restricted-syntax", CORE],
  ["const time = Date();", "no-restricted-syntax", CORE],
  ["const time = performance.now();", "no-restricted-syntax", CORE],
  ["const time = Date.now();", "no-restricted-syntax", ADAPTER],
  ["const time = Date.now();", "no-restricted-syntax", REACT],
  // The inspector is Solid in a shadow root with one React wrapper: it imports no other framework, no provider SDK and no test runner, reads no clock, and arms no timer of its own.
  ['import { useState } from "react";', "no-restricted-imports", DEVTOOLS],
  ['import { render } from "react-dom";', "no-restricted-imports", DEVTOOLS],
  [
    'import { useBeacon } from "@priemskiyyy/beacon-react";',
    "no-restricted-imports",
    DEVTOOLS,
  ],
  [
    'import { BeaconDevtools } from "@priemskiyyy/beacon-devtools";',
    "no-restricted-imports",
    DEVTOOLS,
  ],
  ['import { ref } from "vue";', "no-restricted-imports", DEVTOOLS],
  ['import { onMount } from "svelte";', "no-restricted-imports", DEVTOOLS],
  [
    'import { Platform } from "react-native";',
    "no-restricted-imports",
    DEVTOOLS,
  ],
  ['import { expect } from "vitest";', "no-restricted-imports", DEVTOOLS],
  [
    'import { createSignal } from "solid-js";',
    "no-restricted-imports",
    DEVTOOLS_REACT,
  ],
  [
    'import { render } from "solid-js/web";',
    "no-restricted-imports",
    DEVTOOLS_REACT,
  ],
  ['import { ref } from "vue";', "no-restricted-imports", DEVTOOLS_REACT],
  ["const time = Date.now();", "no-restricted-syntax", DEVTOOLS],
  ["const time = new Date();", "no-restricted-syntax", DEVTOOLS],
  ["const time = performance.now();", "no-restricted-syntax", DEVTOOLS],
  ["setTimeout(() => {}, 0);", "no-restricted-globals", DEVTOOLS],
  ["setInterval(() => {}, 1_000);", "no-restricted-globals", DEVTOOLS],
  ["requestAnimationFrame(() => {});", "no-restricted-globals", DEVTOOLS],
  ["setTimeout(() => {}, 0);", "no-restricted-globals", DEVTOOLS_REACT],
  ["const time = Date.now();", "no-restricted-syntax", DEVTOOLS_CLIPBOARD],
  [
    'export { value } from "src/value";',
    "no-restricted-syntax",
    "packages/devtools/src/utils/index.ts",
  ],
  [
    "export const run = () => useState(0);",
    "react-hooks/rules-of-hooks",
    DEVTOOLS_REACT,
  ],
  [
    'export { value } from "src/value";',
    "no-restricted-syntax",
    "packages/core/src/utils/index.ts",
  ],
  [
    "function value() {\n  console.log(1);\n  return 1;\n}",
    "padding-line-between-statements",
    "scripts/lint-probe.mjs",
  ],
];

const entryPoints = [
  "packages/core/src/index.ts",
  "packages/core/src/mock.ts",
  "packages/core/src/testing.ts",
  "packages/core/src/versions.ts",
  "packages/adapters/http/src/index.ts",
  "packages/adapters/expo/src/mock.ts",
  "packages/react/src/index.ts",
  "packages/devtools/src/index.ts",
  "packages/devtools/src/react.ts",
  "packages/solid/src/index.ts",
  "packages/vue/src/index.ts",
  "packages/svelte/src/index.ts",
];

const allowed = [
  ['import { value } from "src/value";\n\nexport const copy = value;', CORE],
  ...entryPoints.map((file) => ['export { value } from "src/value";', file]),
  ["export const value = { key: 1 } satisfies Record<string, number>;", CORE],
  ['import { expect } from "vitest";\n\nexpect(1).toBe(1);', TEST],
  ['import { expect } from "vitest";\n\nexpect(1).toBe(1);', SUITE],
  [
    'import * as Updates from "expo-updates";\n\nexport const sdk = Updates;',
    "packages/adapters/expo/src/expoUpdates.contracts.ts",
  ],
  [
    'import NetInfo from "@react-native-community/netinfo";\n\nexport const sdk = NetInfo;',
    "packages/core/src/triggers/checkOn.contracts.ts",
  ],
  ["export const view = window;", TRIGGERS_BROWSER],
  [
    'import type remoteConfig from "@react-native-firebase/remote-config";\n\nexport const sdk: typeof remoteConfig | null = null;',
    "packages/adapters/firebase-remote-config/src/firebaseRemoteConfig.contracts.ts",
  ],
  [
    'import { useState } from "react";\n\nexport const useValue = () => useState(0);',
    REACT,
  ],
  [
    'import { createSignal } from "solid-js";\n\nexport const signal = createSignal;',
    SOLID,
  ],
  ['import { ref } from "vue";\n\nexport const value = ref;', VUE],
  [
    'import { writable } from "svelte/store";\n\nexport const store = writable;',
    SVELTE,
  ],
  ['import { value } from "./value.js";\n\nexport const copy = value;', SVELTE],
  [
    'import { vi } from "vitest";\n\nexport const spy = vi.fn();',
    "packages/adapters/http/src/fakeFetch.fixture.ts",
  ],
  ["export const view = globalThis.window;", ADAPTER],
  // The browser adapters run where a document is, so what Hermes lacks is theirs to use.
  [
    'export const href = new URL("https://example.com").href + localStorage.length;',
    "packages/adapters/browser/src/lint-probe.ts",
  ],
  [
    "export const id = crypto.randomUUID();",
    "packages/adapters/service-worker/src/lint-probe.ts",
  ],
  // A plain name is enough: the body does the destructuring, and a function or a sync arrow may take a pattern.
  [
    "export const run = async (context: { scope: string }) => {\n  const { scope } = context;\n\n  return scope;\n};",
    NATIVE_ADAPTER,
  ],
  [
    "export const pick = ({ scope }: { scope: string }) => scope;\n\nexport async function read({ scope }: { scope: string }) {\n  return scope;\n}",
    CORE,
  ],
  [
    'import { createSignal } from "solid-js";\n\nexport const signal = createSignal;',
    DEVTOOLS,
  ],
  [
    'import { render } from "solid-js/web";\n\nexport const mount = render;',
    DEVTOOLS,
  ],
  [
    "export const host = document.createElement('div');\n\nexport const stored = localStorage;\n\nexport const size = window.innerHeight;\n\nexport const agent = navigator.clipboard;",
    DEVTOOLS,
  ],
  ["export const at = new Date(1_000);", DEVTOOLS],
  [
    "export const wait = setTimeout(() => {}, 0);\n\nclearTimeout(wait);",
    DEVTOOLS_CLIPBOARD,
  ],
  [
    'import { useState } from "react";\n\nexport const useValue = () => useState(0);',
    DEVTOOLS_REACT,
  ],
  [
    'import { useBeacon } from "@priemskiyyy/beacon-react";\nimport { BeaconDevtools } from "@priemskiyyy/beacon-devtools";\n\nexport const beacon = [useBeacon, BeaconDevtools];',
    DEVTOOLS_REACT,
  ],
  [
    'import { expect } from "vitest";\n\nexpect(1).toBe(1);',
    "packages/devtools/src/react.test.ts",
  ],
  [
    'import { render } from "@testing-library/react";\n\nexport const view = render;',
    "packages/devtools/src/react.test.ts",
  ],
  [
    "export const cancel = setTimeout(() => {}, 0);\n\nclearTimeout(cancel);",
    CLOCK,
  ],
  ["export const time = Date.now() + performance.now();", CLOCK],
  [
    "export const turn = setTimeout(() => {}, 0);\n\nclearTimeout(turn);",
    SETTLE,
  ],
  ["export const time = Date.now();", TEST],
  ["export const at = new Date(1_000);", CORE],
  [
    "export const run = (flag: boolean) => {\n  if (!flag) {\n    return;\n  }\n\n  console.log(1);\n};",
    CORE,
  ],
  [
    "export const run = (flag: boolean) => {\n  if (flag) {\n    return 1;\n  }\n\n  return 2;\n};",
    CORE,
  ],
];

const getRuleIds = async (code, filePath) => {
  const [result] = await eslint.lintText(code, { filePath });

  return result.messages.map(
    (message) => message.ruleId ?? `parse error: ${message.message}`,
  );
};

const probes = [...syntax, ...boundaries];

for (const [code, rule, filePath = CORE] of probes) {
  const ruleIds = await getRuleIds(code, filePath);

  assert(
    ruleIds.includes(rule),
    `Missing lint rejection: ${rule} in ${filePath}: ${code}`,
  );
}

for (const [code, filePath] of allowed) {
  const ruleIds = await getRuleIds(code, filePath);

  assert.deepEqual(
    ruleIds,
    [],
    `Unexpected lint report ${ruleIds.join(", ")} in ${filePath}: ${code}`,
  );
}

console.log(
  `Verified ${syntax.length} syntax restrictions, ${boundaries.length} boundary rules and ${allowed.length} allowed forms.`,
);
