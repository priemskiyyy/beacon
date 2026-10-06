import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, inject } from "vitest";

// Makes a test run in the JavaScript environment of a React Native app: what
// Hermes and React Native do not have is removed, and what they have in
// another shape is that shape. It runs before a test file is imported, so a
// module that reaches for a missing global as it loads fails too.
//
// The facts are what a bare app has (react-native 0.86, Libraries/Core/setUp*.js)
// and what two Hermes builds have, both run for this: V1 at
// hermes-v250829098.0.17, the default since React Native 0.84, and classic at
// hermes-v0.17.0. A function is removed when either lacks it, so what passes
// here runs on both. Expo's runtime adds structuredClone, TextDecoder, URL and
// AbortSignal.timeout and any, which a bare app does not have.

const define = (target: object, name: string, value: unknown) => {
  Object.defineProperty(target, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: false,
  });
};

const remove = (target: object, name: string) => {
  Reflect.deleteProperty(target, name);
};

// Node has these, and neither Hermes defines them: Web Crypto, structured
// cloning, a text decoder, streams, channels, and the browser's storage. Classic
// Hermes has no WeakRef either.
const ABSENT_GLOBALS = [
  "crypto",
  "structuredClone",
  "TextDecoder",
  "TextDecoderStream",
  "TextEncoderStream",
  "ReadableStream",
  "WritableStream",
  "TransformStream",
  "BroadcastChannel",
  "MessageChannel",
  "MessagePort",
  "MessageEvent",
  "WebAssembly",
  "WeakRef",
  "FinalizationRegistry",
  "Iterator",
  "document",
  "location",
  "localStorage",
  "sessionStorage",
  "Buffer",
];

// Library functions that are newer than Hermes' implementation of the language.
const ABSENT_STATICS: Array<[object, string[]]> = [
  [Promise, ["withResolvers", "try"]],
  [Object, ["groupBy"]],
  [Map, ["groupBy"]],
  [Array, ["fromAsync"]],
];

const ITERATOR_PROTOTYPE = Object.getPrototypeOf(
  Object.getPrototypeOf([][Symbol.iterator]()),
);

const ABSENT_METHODS: Array<[object, string[]]> = [
  [Array.prototype, ["toSorted"]],
  [String.prototype, ["isWellFormed", "toWellFormed"]],
  [
    Set.prototype,
    [
      "union",
      "intersection",
      "difference",
      "symmetricDifference",
      "isSubsetOf",
      "isSupersetOf",
      "isDisjointFrom",
    ],
  ],
  [
    ITERATOR_PROTOTYPE,
    [
      "map",
      "filter",
      "take",
      "drop",
      "flatMap",
      "reduce",
      "toArray",
      "forEach",
      "some",
      "every",
      "find",
    ],
  ],
];

// Hermes has Collator, DateTimeFormat and NumberFormat, and no other Intl service.
const ABSENT_INTL = [
  "Segmenter",
  "PluralRules",
  "ListFormat",
  "RelativeTimeFormat",
  "DisplayNames",
  "Locale",
  "DurationFormat",
];

for (const name of ABSENT_GLOBALS) {
  remove(globalThis, name);
}

for (const [target, names] of [...ABSENT_STATICS, ...ABSENT_METHODS]) {
  for (const name of names) {
    remove(target, name);
  }
}

for (const name of ABSENT_INTL) {
  remove(Intl, name);
}

// Hermes reads an out-of-range field of an ISO timestamp by rolling it over,
// where V8 answers NaN: month 13 is January of the next year, hour 25 is one
// o'clock the next day, second 60 is the next minute. Only `Date.parse` of a
// UTC timestamp is taken over; anything else is the engine's own.
const ISO_UTC =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z)?$/;

const parseWithNode = Date.parse;

define(Date, "parse", (text: string) => {
  const match = ISO_UTC.exec(text);

  if (match === null || Number(match[1]) < 100) {
    return parseWithNode(text);
  }

  const [, year, month, day, hour, minute, second, fraction] = match;

  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
    Number(second ?? 0),
    Number((fraction ?? "0").padEnd(3, "0")),
  );
});

// React Native's AbortController is the `abort-controller` package that it
// depends on: no `reason`, no `throwIfAborted`, no static `abort`, `any` or
// `timeout`, and `abort()` takes no argument. It is loaded from where React
// Native finds it.
const reactNative = createRequire(import.meta.url).resolve(
  "react-native/package.json",
);

const abort = createRequire(reactNative)(
  "abort-controller/dist/abort-controller",
);

define(globalThis, "AbortController", abort.AbortController);
define(globalThis, "AbortSignal", abort.AbortSignal);

// `global.window` and `global.self` are the global object, `navigator` is
// `{ product: "ReactNative" }`, and there is no document.
define(globalThis, "window", globalThis);
define(globalThis, "self", globalThis);
define(globalThis, "navigator", { product: "ReactNative" });

// React Native's own `URL` and `URLSearchParams`: no `URL.canParse`, no setter
// but `search`, and getters that read the string with patterns that know only
// http(s). The test runner itself reads URLs, so they are in place only while a
// test runs: what a module does as it loads still sees the complete ones, and
// the rule that keeps shipped code away from `URL` is the lint rule. A test
// that reads a file names it by path for the same reason.
const libraries = pathToFileURL(`${inject("hermesLibraries")}/`).href;
const native = await import(`${libraries}URL.mjs`);

const complete = {
  URL: Object.getOwnPropertyDescriptor(globalThis, "URL"),
  URLSearchParams: Object.getOwnPropertyDescriptor(
    globalThis,
    "URLSearchParams",
  ),
};

beforeEach(() => {
  define(globalThis, "URL", native.URL);
  define(globalThis, "URLSearchParams", native.URLSearchParams);
});

afterEach(() => {
  for (const [name, descriptor] of Object.entries(complete)) {
    if (descriptor === undefined) {
      continue;
    }

    Object.defineProperty(globalThis, name, descriptor);
  }
});
