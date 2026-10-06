# Release lab on Solid, a Beacon example

The same release lab as [the React app](../react/README.md), written with [`@priemskiyyy/beacon-solid`](../../packages/solid/README.md): one page that runs a real Beacon around a scripted world (a release service you publish, break, slow and expire, a deployment, a support policy, an unsaved draft and a browser that reloads when you say so). Nothing leaves your browser, and nothing here installs anything.

```sh
pnpm install
pnpm build
pnpm --filter example-solid dev
```

The packages are linked from the workspace, so build them first. Open `/?latency=0` to make the release service answer at once instead of after 400 ms.

## What to look at

The page has the four sections of the React app, each with a "Try this" hint, and the same scenarios work: publish a newer build and check, block an update with the unsaved draft, publish a required build, fail, slow or expire the manifest, boot the new build and read what the journal says about the reload. `../react/README.md` lists them.

| Where                                    | What it shows                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/beacon.ts`                          | Merges the lab's Beacon into `Register`, so `useRoute("web")` is typed and `useRoute("elsewhere")` does not compile.                                            |
| `src/Application.tsx`                    | `<BeaconProvider beacon>`, which starts the session, under a keyed `Show`, so a new document is a new tree, as a page load would be.                            |
| `src/components/Document/Document.tsx`   | The startup check, asked through `useBeacon` from `onMount`, once the provider has started the session.                                                         |
| `src/components/Banner/UpdateBanner.tsx` | `useRoute("web", selector)` for the check, the observation and the operation, `useSupport`, and `useBeacon` for `route("web").reload({ offer })` and `check()`. |
| `src/components/Status/`                 | `useBeaconStatus`, `useRoute`, `useRunning` with selectors, and `useObservable` on the diagnostics.                                                             |
| `src/components/Transitions/`            | `useTransitions` with a selector per fact, and `reportReady` and `clearJournal` through `useBeacon`.                                                            |

## How it differs from the React app

- Every primitive returns an accessor, so the components read `check()` and `observation()` and Solid updates only what reads them. Props are never destructured.
- A document is a keyed `Show` over the lab's boot instead of a `key` on the provider.
- Conditional markup uses `Show` and `For`. The icons are one small inline SVG component, not a package, and the page has no dependency beyond the shared ones.
- The unsaved draft participant is registered by the shared lab for every app, so this app does not call `useDisruption`.
- The event log is read with `createSignal` and `onMount` instead of `useSyncExternalStore`, and the tests of the React app have no counterpart here: the shared Playwright spec is the check.

## Automated tests

`pnpm test:browser` builds the packages and runs the shared spec (`../lab.spec.ts`) against this app in Chromium, together with the other apps.
