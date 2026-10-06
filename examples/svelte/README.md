# Release lab, a Beacon example in Svelte

The release lab is one page that runs a real [Beacon](../../README.md) around a scripted world: a release service you publish, break, slow and expire, a deployment that serves builds, a support policy, an unsaved draft and a browser that reloads when you say so. Nothing leaves your browser, and nothing here installs anything. This is the same lab as [the React app](../react/README.md), written with [`@priemskiyyy/beacon-svelte`](../../packages/svelte/README.md) and Svelte 5 runes.

```sh
pnpm install
pnpm build
pnpm --filter example-svelte dev
```

The packages are linked from the workspace, so build them first. Open `/?latency=0` to make the release service answer at once instead of after 400 ms.

## What to look at

The page walks through four sections, each with a "Try this" hint:

1. **What this document knows, and no more.** Session, check, observation, evidence, running build and support, each as its own fact. A missing fact is unknown or pending, never an old version, and a failed check never erases what was accepted.
2. **The update offer.** Publish a newer build and check: the banner offers it. `Update` calls `useBeacon().current.route("web").reload({ offer })`, and the outcome is shown by its `status`. An accepted reload is a request: the running build changes only when the next document boots.
3. **Script the world.** The simulation panel is the controls of the lab, as plain functions: publish, require, roll back or end a build, fail, slow or expire the manifest, an unsaved draft, a lagging deployment, Check now, Boot the new build and Reset demo.
4. **Watch it happen.** The timeline lists Beacon's diagnostics, the journal's changes and what the world did. The transitions panel shows the intent written before the reload and what the next boot says about it.

## Try these

1. Load the page: one read, one accepted answer, `supported`, and `You are up to date`.
2. Publish a newer build, check, tick Unsaved draft and press Update: `blocked`. Untick it and press Update again: `accepted`, `reload-requested`, and the operation stays unresolved.
3. Publish another build before pressing Boot the new build: the journal says `different-target`.
4. Turn on Deployment lags, publish, update and boot twice: `target-not-running`, then the budget is spent.
5. Publish a required build and check: the forced state, with `web` as the route that satisfies the policy.
6. Fail the manifest and check: the offer stays, and the banner says the answer is inconclusive.
7. Expire the answer and press Update: `stale`.

## How it uses the binding

| Utility                    | Where                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BeaconProvider`           | `src/Application.svelte`, keyed by document so a boot is a new tree, which starts the session.             |
| `useRoute("web", select)`  | The route panel and the update banner read the check, the observation and the operation, each on its own.  |
| `useRunning`, `useSupport` | The application panel and the banner.                                                                      |
| `useTransitions`           | The transitions panel.                                                                                     |
| `useBeaconStatus`          | The header and the route panel.                                                                            |
| `useDisruption`            | The simulation panel registers a participant that refuses a reload while the draft it shows is unsaved.    |
| `useBeacon`                | `route("web").reload({ offer })`, `acknowledge()`, `reportReady()` and `clearJournal()` through `current`. |
| `useObservable`            | The lab's world, draft and boot, and Beacon's diagnostics counters.                                        |

`src/beacon.ts` merges the lab's Beacon into `Register`, so `useRoute("web")` is typed and `useRoute("elsewhere")` does not compile.

## How it differs from the React app

- Components are `.svelte` files with runes. Everything a utility returns is read through `current`, and a component reads only the part of the route it shows, by selector.
- The lab reaches the components as context (`mount(..., { context })`, read by `useLab`), because a utility reads its observable once at initialization and Svelte warns when a prop is read there.
- The startup check runs in `onMount` of the page inside the provider, which has started the session by then.
- The timeline reads its log with `createSubscriber` from `svelte/reactivity`.
- Icons are a few inline SVG paths instead of a package.
- There is no component test: the shared Playwright spec (`pnpm test:browser`) runs against this app in Chromium.
