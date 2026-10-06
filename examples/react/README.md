# Release lab, a Beacon example

The release lab is one page that runs a real [Beacon](../../README.md) around a scripted world: a release service you publish, break, slow and expire, a deployment that serves builds, a support policy, an unsaved draft and a browser that reloads when you say so. Nothing leaves your browser, and nothing here installs anything.

```sh
pnpm install
pnpm build
pnpm --filter example-react dev
```

The packages are linked from the workspace, so build them first. Open `/?latency=0` to make the release service answer at once instead of after 400 ms.

## What to look at

The page walks through four sections, each with a "Try this" hint:

1. **What this document knows, and no more.** Session, check, observation, evidence, running build and support, each as its own fact. A missing fact is unknown or pending, never an old version, and a failed check never erases what was accepted.
2. **The update offer.** Publish a newer build and check: the banner offers it. `Update` calls `useBeacon().route("web").reload({ offer })`, and the outcome is shown by its `status`. An accepted reload is a request: the running build changes only when the next document boots.
3. **Script the world.** The simulation panel is the controls of the lab, as plain functions:
   - Publish a newer build, publish a required build (the running build becomes unsupported), roll back, return no update, end the running build.
   - Fail the manifest, slow it (a read waits until `Answer held read`, or until `Skip 10 seconds` reaches its deadline), expire the answer.
   - An unsaved draft, which refuses the reload through a disruption participant and locks while a reload holds its reservation. A lagging deployment, which serves the old build to a new document.
   - Check now, Boot the new build (the navigation completes), and Reset demo.
4. **Watch it happen.** The timeline lists Beacon's diagnostics, the journal's changes and what the world did. The transitions panel shows the intent written before the reload and what the next boot says about it: `target-running`, `target-not-running` (with the attempt budget), `different-target` or `inconclusive`.

## Try these

1. Load the page: one read, one accepted answer, `supported`, and `You are up to date`.
2. Publish a newer build, check, tick Unsaved draft and press Update: `blocked`, with the participant that asked. Untick it and press Update again: `accepted`, `reload-requested`, and the operation stays unresolved.
3. Publish another build before pressing Boot the new build: the journal says `different-target`.
4. Turn on Deployment lags, publish, update and boot twice: `target-not-running`, then the budget is spent.
5. Publish a required build and check: the forced state, with `web` as the route that satisfies the policy. End the running build instead: nothing usable, shown as it is.
6. Fail the manifest and check: the offer stays, the check says `failed`, and the banner says the answer is inconclusive. Boot a document while it fails: nothing is observed, and the banner does not guess.
7. Expire the answer and press Update: `stale`, because the evidence behind the offer no longer holds.

## How it fits together

| File                                           | Role                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `../shared/lab/createReleaseLab.ts`            | The scripted world, the controls, and one Beacon per document over the same journal.                                                    |
| `../shared/lab/utils/createLabBeacon.ts`       | The Beacon: a `web` target route, the support policy over the same read, and the journal.                                               |
| `../shared/lab/utils/createManifestSource.ts`  | The release service, over `createMockSource` from `@priemskiyyy/beacon/mock`.                                                           |
| `../shared/lab/utils/createReloadMechanism.ts` | The `reload` command: it requests a navigation and returns a `reload-requested` receipt.                                                |
| `src/beacon.ts`                                | Merges the lab's Beacon into `Register`, so `useRoute("web")` is typed and `useRoute("elsewhere")` does not compile.                    |
| `src/Application.tsx`                          | Publishes the Beacon with `<BeaconProvider start>`, keyed by document, and asks for the startup check once the provider has started it. |
| `../shared/formatting/`                        | Every state in words, matched exhaustively.                                                                                             |
| `src/components/`                              | One folder per panel; the styles are the shared `cva` recipes.                                                                          |

## Automated tests

`pnpm exec vitest run --project example-shared` tests the lab without a browser, on a test clock. `pnpm exec vitest run --project example-react` renders the application in jsdom. `pnpm test:browser` builds the packages and runs the lab and the Expo web export in Chromium.
