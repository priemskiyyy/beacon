import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const toRestrictions = (entries) =>
  entries.map(([selector, message]) => ({ selector, message }));

const relativeImports = toRestrictions([
  [
    "ImportDeclaration[source.value=/^[.]/]",
    "Use src/... imports or public package imports.",
  ],
  [
    "ExportNamedDeclaration[source.value=/^[.]/]",
    "Use src/... imports for public exports.",
  ],
  [
    "ImportExpression[source.value=/^[.]/]",
    "Use src/... imports for dynamic imports.",
  ],
  [
    "TSImportType[source.value=/^[.]/]",
    "Use src/... imports for imported types.",
  ],
]);

const bannedSyntax = toRestrictions([
  [
    "TSAsExpression",
    "Do not use type assertions, including as const. Narrow the value, annotate the type, or use satisfies.",
  ],
  [
    "TSTypeAssertion",
    "Do not use type assertions. Narrow the value, annotate the type, or use satisfies.",
  ],
  ["TSNonNullExpression", "Narrow nullable values before using them."],
  ["TSEnumDeclaration", "Use a string union instead of an enum."],
  ["SwitchStatement", "Use explicit conditional dispatch."],
  [
    "UnaryExpression[operator='void']",
    "Handle promise completion and failures explicitly.",
  ],
  ["AssignmentExpression[operator='??=']", "Use explicit assignment."],
  ["AssignmentExpression[operator='||=']", "Use explicit assignment."],
  ["AssignmentExpression[operator='&&=']", "Use explicit assignment."],
  ["TSPropertySignature[readonly=true]", "Use mutable public property types."],
  ["TSIndexSignature[readonly=true]", "Use mutable index signatures."],
  ["PropertyDefinition[readonly=true]", "Use mutable property types."],
  ["TSParameterProperty[readonly=true]", "Use mutable property types."],
  [
    "TSMappedType[readonly]",
    "Do not add readonly mapped modifiers. Use the mutable type; published data is frozen at runtime.",
  ],
  ["TSTypeOperator[operator='readonly']", "Use mutable array types."],
  [
    "TSTypeReference[typeName.name=/^(Readonly|ReadonlyArray|ReadonlyMap|ReadonlySet|DeepReadonly)$/]",
    "Do not use readonly utility types. Use the mutable type; published data is frozen at runtime.",
  ],
  ["ExportAllDeclaration", "List public exports explicitly."],
  [
    "MemberExpression[property.name='throwIfAborted']",
    "React Native's AbortSignal has no throwIfAborted. Check signal.aborted.",
  ],
  [
    "MemberExpression[property.name='removeAllListeners']",
    "Remove only the subscriptions this code added; the source is borrowed.",
  ],
  [
    "CallExpression[callee.property.name='configure']",
    "Never configure a borrowed SDK; the application owns its configuration.",
  ],
]);

const reexports = toRestrictions([
  [
    "ExportNamedDeclaration[source]",
    "Keep explicit re-exports at public package entry points only.",
  ],
]);

const entryPoints = [
  "packages/*/src/index.ts",
  "packages/adapters/*/src/index.ts",
  "packages/core/src/mock.ts",
  "packages/core/src/testing.ts",
  "packages/core/src/versions.ts",
];

const tests = [
  "**/*.test.{ts,tsx}",
  "**/*.contracts.{ts,tsx}",
  "**/*.fixture.{ts,tsx}",
];

// Package names are exact paths; a bare pattern would also match a folder.
const restrictImports = (forbidden) => ({
  "no-restricted-imports": [
    "error",
    {
      paths: forbidden.flatMap(({ names, message }) =>
        names.map((name) => ({ name, message })),
      ),
      patterns: forbidden.map(({ groups, message }) => ({
        group: groups,
        message,
      })),
    },
  ],
});

const react = {
  names: ["react", "react-dom"],
  groups: ["react-dom/*"],
  message: "Only the React binding imports React.",
};

const sdks = {
  names: ["react-native", "expo-updates", "expo-application", "workbox-window"],
  groups: [
    "react-native/*",
    "expo-updates/*",
    "expo-application/*",
    "workbox-window/*",
  ],
  message:
    "No runtime code imports a provider SDK; the application passes it in, and the type is structural.",
};

const testRunners = {
  names: ["vitest"],
  groups: ["vitest/*", "@testing-library/*"],
  message: "Runtime code never imports a test runner.",
};

// Every duration is measured on the Beacon clock, so tests control time and
// suspension; only the system clock reads the host's timers.
const hostTimers = [
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "requestAnimationFrame",
  "requestIdleCallback",
].map((name) => ({
  name,
  message: "Schedule through the Beacon clock, never the host's timers.",
}));

const hostGlobals = ["window", "document", "navigator", "self"].map((name) => ({
  name,
  message:
    "The core is platform neutral; a host is reached only through an adapter.",
}));

// React Native's engines and older browsers lack these, so library code
// detects nothing and depends on none of them.
const portableGlobals = [
  ["BigInt", "Compare decimal strings without BigInt."],
  [
    "structuredClone",
    "Copy values explicitly; structuredClone is missing on React Native.",
  ],
  ["TextDecoder", "Decode explicitly; TextDecoder is missing on React Native."],
  ["TextEncoder", "Encode explicitly; TextEncoder is missing on React Native."],
].map(([name, message]) => ({ name, message }));

const clockReads = [
  {
    object: "Date",
    property: "now",
    message: "Read time from the Beacon clock.",
  },
  {
    object: "performance",
    property: "now",
    message: "Read time from the Beacon clock.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      ".artifacts/**",
      "tasks/**",
      "docs/.vitepress/cache/**",
      "docs/.vitepress/dist/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  {
    // No inline comment can switch a rule off; an exception is a file-scoped block here.
    linterOptions: { noInlineConfig: true },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    rules: {
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: ["const", "let"] },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        {
          blankLine: "any",
          prev: ["singleline-const", "singleline-let"],
          next: ["singleline-const", "singleline-let"],
        },
        { blankLine: "always", prev: "*", next: "block-like" },
        { blankLine: "always", prev: "block-like", next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      curly: ["error", "all"],
      "no-else-return": ["error", { allowElseIf: false }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-syntax": ["error", ...relativeImports, ...bannedSyntax],
    },
  },
  {
    files: ["packages/**/src/**/*.{ts,tsx}"],
    ignores: entryPoints,
    rules: {
      "no-restricted-syntax": [
        "error",
        ...relativeImports,
        ...bannedSyntax,
        ...reexports,
      ],
    },
  },
  {
    files: ["packages/core/src/**/*.ts"],
    ignores: tests,
    rules: {
      ...restrictImports([react, sdks, testRunners]),
      "no-restricted-globals": [
        "error",
        ...hostTimers,
        ...hostGlobals,
        ...portableGlobals,
      ],
      "no-restricted-properties": ["error", ...clockReads],
    },
  },
  {
    // The system clock is the one owner of the host's timers and time sources.
    files: ["packages/core/src/utils/internal/clock/createSystemClock.ts"],
    rules: {
      "no-restricted-globals": ["error", ...hostGlobals, ...portableGlobals],
      "no-restricted-properties": "off",
    },
  },
  {
    files: ["packages/adapters/*/src/**/*.ts"],
    ignores: tests,
    rules: {
      ...restrictImports([react, sdks, testRunners]),
      "no-restricted-globals": ["error", ...hostTimers, ...portableGlobals],
      "no-restricted-properties": ["error", ...clockReads],
    },
  },
  {
    // A binding reads Beacon's observables and never a provider SDK or the host's timers.
    files: ["packages/react/src/**/*.{ts,tsx}"],
    ignores: tests,
    rules: {
      ...restrictImports([sdks, testRunners]),
      "no-restricted-globals": ["error", ...hostTimers, ...portableGlobals],
      "no-restricted-properties": ["error", ...clockReads],
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        Buffer: "readonly",
      },
    },
  },
);
