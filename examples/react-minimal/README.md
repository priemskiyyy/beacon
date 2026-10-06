# Notes, Beacon in a React web app

The smallest React and Vite app that does what [Getting started](../../docs/getting-started.md) teaches: it shows a banner when a deploy has put a newer build on the server, never reloads over a note that is not saved, and checks again when the tab comes back or the network returns. Five source files and a nine-line manifest, with no shared code. Copy it. The [release lab](../react/README.md) next to it is the app the tests use to script a whole world, not the way to start.

```sh
pnpm install
pnpm build
pnpm --filter example-react-minimal dev
```

The packages are linked from the workspace, so build them first. In an application of your own: `pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react @priemskiyyy/beacon-http @priemskiyyy/beacon-browser`.

## The files

| File                   | What it does                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/beacon.ts`        | The Beacon: the scope, `webBuild` for the build that runs, `standardManifestSource` for what `/releases.json` names, `targetRoute` with `browserReload`, `browserStorage` for the journal, and the `Register` line. |
| `src/App.tsx`          | `BeaconProvider`, which starts the session, and `checkOn` with `foreground()` and `reconnect()` from `@priemskiyyy/beacon/triggers/browser`. It also checks when the page loads.                                    |
| `src/UpdateBanner.tsx` | `useRoute("web")` and `reload({ offer })`: the banner shows while a newer build is on offer, and says why when the reload is blocked.                                                                               |
| `src/DraftForm.tsx`    | The guard: `useDisruption` answers `blocked` while the note is not saved, so a reload cannot reach it.                                                                                                              |
| `src/main.tsx`         | Mounts the app.                                                                                                                                                                                                     |
| `public/releases.json` | What a deploy writes: the build the visitors should run.                                                                                                                                                            |

[Getting started](../../docs/getting-started.md) explains these files one after another, and its code is these files. When the page and a file disagree, the file is right: it is compiled, built and run in Chromium.

## The build id and the manifest

Two places name the build, and they must agree: the bundle, which `vite build` stamps with `VITE_BUILD_ID` (the scripts in `package.json` set it to `a91b44e`; a pipeline sets it to the commit), and `releases.json`, which the same pipeline writes with the same value. The banner shows when they differ. An id nobody defined is not a build: the running build is unknown and no banner is shown.

The manifest here is the shortest valid one: no times, because a file on a static host has no authority to say when it expires, and an identity written as text, which means a build named under this application, as a web artifact. The source asks the browser to revalidate on each check.

## Seeing it

```sh
pnpm --filter example-react-minimal build
pnpm --filter example-react-minimal exec vite preview --host 127.0.0.1
```

Open the page, change `identity` in `dist/releases.json` to another value, and switch to another tab and back: the banner shows. Type a note and press `Update`: it is blocked. Press `Save` and `Update` again: the page reloads, and since this build is still `a91b44e`, the banner comes back, which is what a deploy that has not finished looks like.

## Tests

`pnpm test:browser` runs `react-minimal.spec.ts` in Chromium among the others, and builds what it needs. By hand, with the preview above on port 4495: `EXAMPLE_SERVERS_STARTED=1 pnpm exec playwright test -c examples/playwright.config.ts --project react-minimal`. The spec plays the deployment, serving the manifest and, from the moment a deploy has finished, the built script with a new build id, and shows four things:

- no banner while the manifest names the build that runs;
- a banner when it names another;
- a note that is not saved blocks the update, and once it is saved the page reloads into the new build;
- a deploy while the tab is open is found when the network comes back.

It does not run a service worker, which changes what a reload loads: [the browser page](../../docs/browser.md) says what to do if you ship one that precaches the app. It runs Chromium only.
