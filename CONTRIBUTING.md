# Contributing

Use Node 22.18 or newer and the pnpm version in `package.json`. Run `pnpm install --frozen-lockfile`, then `pnpm check` before submitting a change. It builds every package, typechecks, lints, runs the lint rule probes, checks that the verification table matches the tests, that the documented limits are still stated that a built package imports only what its role allows and that each built entry is within its gzip budget, that the documentation's pages and links are sound and that every code fence in it and every example in a JSDoc block compiles against the built packages, checks formatting and runs every test. `pnpm test:mutation` weakens one guarded rule at a time and fails when a test does not notice; add a mutant to `scripts/mutate.mjs` for a rule you protect. `pnpm test:mutation --project <name>` runs only the mutants of that vitest project, and the flag may be repeated; every mutant's `find` is still checked to occur exactly once.

## Layout

- `packages/core`: the runtime, published as `@priemskiyyy/beacon` with the `./versions`, `./mock` and `./testing` subpaths.
- `packages/adapters/*`: one package per source or provider, published as `@priemskiyyy/beacon-<name>`: `http` defines a release source over the application's own client, `browser` reloads the document, keeps the journal in web storage and reads the running web build, `service-worker`, `expo`, `code-push`, `google-play` and `app-store` map a provider, `firebase-remote-config` defines a release source over Firebase Remote Config, `native` reads the installed native build, and `triggers` checks a Beacon when the app starts, returns, reconnects or waits.
- `packages/react`, `packages/solid`, `packages/vue` and `packages/svelte`: the framework bindings, each a provider and the same primitives in its framework's idiom, read by route name from the `Register`ed Beacon.
- `docs/`: the VitePress site, with the guides, the adapters, the bindings, the decision record, the runtime architecture and the verification table.
- `examples/`: the release lab shared by a React app and an Expo app, the Playwright specs that run them in Chromium, and the one that runs the browser package's storage and build reader in a page of its own.
- `scripts/`: the checks beyond the tests. `verify-peers.mjs` installs the oldest SDK each adapter claims, outside the workspace, and typechecks the adapter's structural type against it; it needs the network and is not part of `pnpm check`, so run it (`pnpm verify:peers`) when a structural SDK type changes and before a release. `verify-lint-rules.mjs` proves each lint rule still rejects what it was written for, and `verify-scenarios.mjs` keeps the verification table in step with the tests. Each has been probed with a deliberately broken input, so keep that habit when changing one.

Runtime owners and helpers live in `utils/`, constants in `utils/constants/`, and shared contracts in `types/`, one type per file. Internal code belongs in each folder's `internal/` directory, so `utils/internal/` holds the helpers no consumer may import. The mock lives in `mock/` and the conformance suites in `testing/`. Package roots export the supported public API explicitly, and no other file is a barrel. An adapter keeps its factory in `src/<name>.ts`, its mapping in `utils/`, and the provider's names and reasons in `utils/constants/`.

## Code

Prefer descriptive names, early returns, guard clauses over compound conditions, `type` over `interface`, and exhaustive dispatch closed by `assertUnreachable`. Name a helper for what it returns, such as `readWorkers`. Group related fields instead of stacking their names. No `enum`, `switch`, `any`, `as` casts or `as const`, the `void` operator, `readonly`, or the logical assignment operators. ESLint keeps a blank line around declarations, blocks and returns. Use `src/...` imports within each package. Avoid introducing a shared abstraction for a single use.

Types come before runtime checks. When a type can make a wrong call fail to compile, it does, and a `*.contracts.ts` file proves it with `@ts-expect-error` and a reason on the exact line where the compiler reports. Runtime checks remain only for what a type cannot say.

Beacon never throws into its host from a callback. A source, a mechanism, a participant or a listener that throws becomes a status, an error in state or a diagnostic.

## Adapters

A release source is `{ name, read, select }`, made with `createReleaseSource`. A mechanism (`createUpdateMechanism`) carries commands for a route whose offers come from a source. A driver (`createReleaseDriver`) owns a provider's check, its prepared targets and its commands. The rules that are easiest to break:

- The factory is cold: nothing is read, subscribed or registered until a session opens, and a host without the provider is inert, never an error.
- It takes the SDK the application set up, never configures it, and removes only the listeners it added.
- It never claims more than the provider gave. A command's receipt names what was accepted, and nothing it returns changes what is running.
- A native handle is an object. `null` means the route is not open.
- It runs the matching conformance suite from `@priemskiyyy/beacon/testing` in `src/conformance.test.ts`, tests against an in-process fake in `src/fake<Sdk>.fixture.ts`, and proves the real SDK's types fit in `src/<name>.contracts.ts`. Adapter tests import the core by its package name, so run `pnpm build` first.

## Testing

`pnpm test:unit` runs one vitest project per package, each with a `src` alias onto its own source. Tests sit beside their sources and are named after the specification row they prove, such as `SAFE-03`, when there is one. A new test is watched failing once before it is trusted. Time is the test clock's, never a sleep; interleaving is tested with held reads, held settlements and held provider calls.

The packages a React Native app runs also run under a Hermes-like environment, because Node has much that Hermes lacks. `test/hermes/setup.ts` removes it from each test's globals (`crypto`, `structuredClone`, `TextDecoder`, streams, `WeakRef`, `Promise.withResolvers`, `Object.groupBy`, `toSorted`, the `Set` methods and the extra `Intl` services), makes `Date.parse` roll an out-of-range field over as both Hermes builds do, and puts React Native's own `AbortController`, `URL` and `URLSearchParams` in their place (the real sources, compiled once by `test/hermes/globalSetup.ts`, and installed only while a test runs). The list comes from running a real Hermes V1 and classic build, not from memory; change it only with evidence. It runs as the projects `core-hermes`, `http-hermes`, `expo-hermes`, `google-play-hermes`, `app-store-hermes`, `native-hermes`, `triggers-hermes`, `code-push-hermes` and `firebase-remote-config-hermes` (the `HERMES` table of `vitest.config.ts`: add a package there), as `react-native` for the React binding under `react-test-renderer` (`*.native.test.tsx`), and as `hermes-harness`, which tests the environment itself and scans each built package for syntax Hermes V1 compiles wrongly, so run `pnpm build` first. A test in these projects names a file by a path, never `new URL(..., import.meta.url)`, since `URL` is React Native's there. ESLint forbids the same globals and syntax in the shipped sources, with a probe for each rule in `scripts/verify-lint-rules.mjs`.

Everything runs against fakes. What a device or a real browser still has to verify is in [the decision record](docs/decisions.md).

## Commits

Commit in small, atomic steps with short conventional messages, such as `feat(expo): map the whole check result`. No em dashes or attribution footers anywhere in the repository, including commit messages and changelog entries.
