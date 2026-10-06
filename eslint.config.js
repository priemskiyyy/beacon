import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
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
    "CallExpression[callee.property.name='map'][callee.object.callee.property.name='filter']",
    "Use one .flatMap() with early returns: return [] to skip, return [value] to keep.",
  ],
  [
    "CallExpression[callee.property.name='filter'][callee.object.callee.property.name='map']",
    "Use one .flatMap() with early returns: return [] to skip, return [value] to keep.",
  ],
  [
    "ReturnStatement > ConditionalExpression",
    "Return early from an if instead of returning a ternary.",
  ],
  [
    "ArrowFunctionExpression > ConditionalExpression.body",
    "Give the arrow a block that returns early from an if instead of a ternary body.",
  ],
  [
    ":function > BlockStatement > IfStatement[alternate=null]:last-child",
    "Guard, then work: write `if (!condition) { return; }` and do the work after it, instead of ending a function with an if block.",
  ],
  [
    ":matches(ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement) > BlockStatement > IfStatement[alternate=null]:last-child",
    "Guard, then work: write `if (!condition) { continue; }` and do the work after it, instead of ending a loop body with an if block.",
  ],
  [
    "MemberExpression[property.name='throwIfAborted']",
    "React Native's AbortSignal has no throwIfAborted(): check signal.aborted.",
  ],
  [
    "MemberExpression[object.name='AbortSignal'][property.name=/^(abort|any|timeout)$/]",
    "React Native's AbortSignal has no static abort(), any() or timeout(): use an AbortController.",
  ],
  [
    "MemberExpression[property.name='reason'][object.property.name='signal']",
    "React Native's AbortSignal has no reason: reject with an error of your own.",
  ],
  [
    "MemberExpression[object.name='signal'][property.name='reason']",
    "React Native's AbortSignal has no reason: reject with an error of your own.",
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

// Every instant is read from the Beacon clock, so tests control time and
// suspension; only the system clock reads the host's time.
const clockReads = toRestrictions([
  [
    "MemberExpression[object.name='Date'][property.name='now']",
    "Read time from the Beacon clock.",
  ],
  [
    "NewExpression[callee.name='Date'][arguments.length=0]",
    "Read time from the Beacon clock.",
  ],
  ["CallExpression[callee.name='Date']", "Read time from the Beacon clock."],
  [
    "MemberExpression[object.name='performance'][property.name='now']",
    "Read time from the Beacon clock.",
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

const packageSyntax = [...relativeImports, ...bannedSyntax, ...reexports];

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
      "no-restricted-syntax": ["error", ...packageSyntax],
    },
  },
  {
    files: ["packages/core/src/**/*.ts"],
    ignores: [...tests, ...entryPoints, "packages/core/src/testing/**"],
    rules: {
      ...restrictImports([react, sdks, testRunners]),
      "no-restricted-globals": [
        "error",
        ...hostTimers,
        ...hostGlobals,
        ...portableGlobals,
      ],
      "no-restricted-syntax": ["error", ...packageSyntax, ...clockReads],
    },
  },
  {
    // A conformance suite runs inside the adapter's own test run, so it is the one part of the core that imports the runner.
    files: ["packages/core/src/testing/**/*.ts"],
    ignores: [...tests, ...entryPoints],
    rules: {
      ...restrictImports([react, sdks]),
      "no-restricted-globals": [
        "error",
        ...hostTimers,
        ...hostGlobals,
        ...portableGlobals,
      ],
      "no-restricted-syntax": ["error", ...packageSyntax, ...clockReads],
    },
  },
  {
    // The system clock is the one owner of the host's timers and time sources.
    files: ["packages/core/src/utils/internal/clock/createSystemClock.ts"],
    rules: {
      "no-restricted-globals": ["error", ...hostGlobals, ...portableGlobals],
      "no-restricted-syntax": ["error", ...packageSyntax],
    },
  },
  {
    files: ["packages/adapters/*/src/**/*.ts"],
    ignores: [...tests, ...entryPoints],
    rules: {
      ...restrictImports([react, sdks, testRunners]),
      "no-restricted-globals": ["error", ...hostTimers, ...portableGlobals],
      "no-restricted-syntax": ["error", ...packageSyntax, ...clockReads],
    },
  },
  {
    // A binding reads Beacon's observables and never a provider SDK or the host's timers.
    files: ["packages/react/src/**/*.{ts,tsx}"],
    ignores: [...tests, ...entryPoints],
    rules: {
      ...restrictImports([sdks, testRunners]),
      "no-restricted-globals": ["error", ...hostTimers, ...portableGlobals],
      "no-restricted-syntax": ["error", ...packageSyntax, ...clockReads],
    },
  },
  {
    // React rules only where React runs.
    files: ["packages/react/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
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
