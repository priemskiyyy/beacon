# Release lab on Vue

This is a lab for the tests, not the way to start: [Vue](../../docs/vue.md) is the page to read, and [the minimal React example](../react-minimal/README.md) shows the shortest working app.

The same release lab as the [React example](../react/README.md), written with `@priemskiyyy/beacon-vue`: one page that runs a real [Beacon](../../README.md) around a scripted world (a release service you publish, break, slow and expire, a deployment, a support policy, an unsaved draft and a browser that reloads when you say so). Nothing leaves your browser, and nothing here installs anything.

```sh
pnpm install
pnpm build
pnpm --filter example-vue dev
```

The packages are linked from the workspace, so build them first. Open `/?latency=0` to make the release service answer at once instead of after 400 ms.

## What to look at

The page walks through four sections, each with a "Try this" hint, and every scenario of the React example applies unchanged: see its README for the list.

| Panel           | Binding                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Route web       | `useBeaconStatus` and `useRoute("web", selector)`: one selector per dimension, so a panel reads only its own. |
| Application     | `useRunning`, `useSupport`, and `useObservable` for the diagnostics counters.                                 |
| Update banner   | `useRoute`, `useSupport` and `useBeacon().value.route("web").reload({ offer })`, `acknowledge()`.             |
| Transitions     | `useTransitions` and `useBeacon().value` for `reportReady` and `clearJournal`.                                |
| Simulated world | `useObservable` over the lab's own world and draft stores.                                                    |

`src/Application.vue` publishes the Beacon with `<BeaconProvider :beacon>`, which starts the session, keyed by document, and asks for the startup check once the provider has started the session.

## How it differs from the React app

- Single-file components with `<script setup lang="ts">`. Every composable returns a read-only `ComputedRef`: `.value` in a script, auto-unwrapped in a template.
- Icons are small inline SVG paths (`src/utils/constants/iconPaths.ts`) instead of an icon package.
- `useDisruption` is not used: the lab registers the unsaved draft participant itself, on each document's Beacon, so a second registration would ask twice.
- The startup check runs from `onMounted` and from a `flush: "post"` watcher on the document's Beacon, since the provider starts the session before its children mount.
- There is no jsdom test here; the shared Playwright spec (`pnpm test:browser`) runs against this app in Chromium.
