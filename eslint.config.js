import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import sveltePlugin from "eslint-plugin-svelte";
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
  "packages/devtools/src/react.ts",
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

const solid = {
  names: ["solid-js"],
  groups: ["solid-js/*"],
  message: "Only the Solid binding imports Solid.",
};

const vue = {
  names: ["vue"],
  groups: ["vue/*", "@vue/*"],
  message: "Only the Vue binding imports Vue.",
};

const svelte = {
  names: ["svelte"],
  groups: ["svelte/*"],
  message: "Only the Svelte binding imports Svelte.",
};

const sdks = {
  names: [
    "react-native",
    "expo-updates",
    "expo-application",
    "workbox-window",
    "react-native-device-info",
    "react-native-code-push",
    "@revopush/react-native-code-push",
    "@bravemobile/react-native-code-push",
    "@appzung/react-native-code-push",
    "@react-native-community/netinfo",
    "firebase",
  ],
  groups: [
    "react-native/*",
    "expo-updates/*",
    "expo-application/*",
    "workbox-window/*",
    "react-native-device-info/*",
    "react-native-code-push/*",
    "@revopush/react-native-code-push/*",
    "@bravemobile/react-native-code-push/*",
    "@appzung/react-native-code-push/*",
    "@react-native-firebase/*",
    "@react-native-community/netinfo/*",
    "firebase/*",
  ],
  message:
    "No runtime code imports a provider SDK; the application passes it in, and the type is structural.",
};

const frameworks = [react, solid, vue, svelte];

// The devtools are a Solid inspector in a shadow root with one React wrapper, so their boundaries differ from the bindings'.
const devtoolsReact = {
  names: ["react", "react-dom"],
  groups: [
    "react-dom/*",
    "@priemskiyyy/beacon-react",
    "@priemskiyyy/beacon-react/*",
  ],
  message:
    "Only the React wrapper, src/react.ts, imports React and its binding.",
};

const devtoolsSelf = {
  names: ["@priemskiyyy/beacon-devtools"],
  groups: ["@priemskiyyy/beacon-devtools/*"],
  message:
    "Inside the package import src/...; only the React wrapper imports the inspector by its name, so that it shares the one copy.",
};

const devtoolsSolid = {
  names: ["solid-js"],
  groups: ["solid-js/*"],
  message:
    "The React wrapper reaches the inspector by its package name; Solid is bundled inside it.",
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

const devtoolsTimers = [
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "requestAnimationFrame",
  "requestIdleCallback",
].map((name) => ({
  name,
  message:
    "The inspector arms no timer of its own; the copy feedback in useClipboard is the one exception.",
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
      "**/.svelte-kit/**",
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
  ...sveltePlugin.configs.recommended,
  {
    // Template comments disable rules through this plugin rule, which noInlineConfig does not reach.
    files: ["**/*.svelte"],
    rules: { "svelte/comment-directive": "off" },
  },
  {
    files: ["**/*.{js,mjs,ts,tsx,svelte}"],
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
    files: ["**/*.{ts,tsx,svelte}"],
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
    files: ["packages/**/src/**/*.{ts,tsx,svelte}"],
    ignores: entryPoints,
    rules: {
      "no-restricted-syntax": ["error", ...packageSyntax],
    },
  },
  {
    // svelte-package rewrites no aliases, so the Svelte binding imports by relative path.
    files: ["packages/svelte/**/*.{ts,svelte}"],
    rules: { "no-restricted-syntax": ["error", ...bannedSyntax] },
  },
  {
    files: ["packages/svelte/src/**/*.{ts,svelte}"],
    ignores: entryPoints,
    rules: {
      "no-restricted-syntax": ["error", ...bannedSyntax, ...reexports],
    },
  },
  {
    files: ["packages/core/src/**/*.ts"],
    ignores: [...tests, ...entryPoints, "packages/core/src/testing/**"],
    rules: {
      ...restrictImports([...frameworks, sdks, testRunners]),
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
      ...restrictImports([...frameworks, sdks]),
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
      ...restrictImports([...frameworks, sdks, testRunners]),
      "no-restricted-globals": ["error", ...hostTimers, ...portableGlobals],
      "no-restricted-syntax": ["error", ...packageSyntax, ...clockReads],
    },
  },
  ...[
    { framework: react, files: ["packages/react/src/**/*.{ts,tsx}"] },
    { framework: solid, files: ["packages/solid/src/**/*.{ts,tsx}"] },
    { framework: vue, files: ["packages/vue/src/**/*.{ts,tsx}"] },
    {
      framework: svelte,
      files: ["packages/svelte/src/**/*.{ts,svelte}"],
      // svelte-package rewrites no aliases, so this binding imports by relative path.
      syntax: [...bannedSyntax, ...reexports],
    },
  ].map(({ framework, files, syntax = packageSyntax }) => ({
    // A binding reads Beacon's observables, imports only its own framework, and never a provider SDK or the host's timers.
    files,
    ignores: [...tests, ...entryPoints],
    rules: {
      ...restrictImports([
        ...frameworks.filter((other) => other !== framework),
        sdks,
        testRunners,
      ]),
      "no-restricted-globals": ["error", ...hostTimers, ...portableGlobals],
      "no-restricted-syntax": ["error", ...syntax, ...clockReads],
    },
  })),
  ...[
    {
      files: ["packages/devtools/src/**/*.{ts,tsx}"],
      ignores: [...tests, ...entryPoints],
      forbidden: [devtoolsReact, devtoolsSelf, vue, svelte, sdks, testRunners],
      syntax: packageSyntax,
    },
    {
      files: ["packages/devtools/src/index.ts"],
      forbidden: [devtoolsReact, devtoolsSelf, vue, svelte, sdks, testRunners],
      syntax: [...relativeImports, ...bannedSyntax],
    },
    {
      files: ["packages/devtools/src/react.ts"],
      forbidden: [devtoolsSolid, vue, svelte, sdks, testRunners],
      syntax: [...relativeImports, ...bannedSyntax],
    },
  ].map(({ files, ignores = [], forbidden, syntax }) => ({
    // The inspector imports Solid and reaches the DOM, never another framework or a provider SDK, and it reads no clock: its times come from the events and the snapshots.
    files,
    ignores,
    rules: {
      ...restrictImports(forbidden),
      "no-restricted-globals": ["error", ...devtoolsTimers],
      "no-restricted-syntax": ["error", ...syntax, ...clockReads],
    },
  })),
  {
    // A copy button says "Copied" for a moment: the one timer the inspector arms, cleared when the button goes.
    files: ["packages/devtools/src/hooks/useClipboard.ts"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    // Declaration merging is how an application tells a binding which Beacon it has, and only an interface can be merged.
    files: [
      "packages/*/src/types/Register.ts",
      "packages/*/src/register.fixture.ts",
      "examples/*/src/beacon.ts",
    ],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    // React rules only where React runs.
    files: [
      "packages/react/**/*.{ts,tsx}",
      "packages/devtools/src/react.{ts,tsx}",
      "packages/devtools/src/react.*.{ts,tsx}",
      "examples/{react,expo}/**/*.{ts,tsx}",
    ],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
    },
    rules: { "no-undef": "off" },
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
