# Releasing the packages

All fifteen packages share one version line. Each has its own GitHub release tag, and one publishing workflow serves them all. Pushes and verification runs publish nothing.

The release tag uses the package name without its scope: `<name>-v<version>`, for example `beacon-expo-v0.1.0` for `@priemskiyyy/beacon-expo`, and `beacon-v0.1.0` for the core. The publish workflow resolves the package from the tag, verifies its metadata and changelog entry, runs every test workflow, and publishes the verified tarball from `.artifacts/release/<package>/` with provenance, after checking its checksum. It publishes the tarball that was tested, not a rebuild. Prereleases use the `next` dist-tag, and stable releases use `latest`.

## The order

Publish `@priemskiyyy/beacon` first. Its `./adapter`, `./versions`, `./mock`, `./testing`, `./triggers` and `./triggers/browser` subpaths ship with it, and there is no package of their own. Every other package declares the core as a peer dependency, so a dependent published before the core cannot be installed. Then, in any order:

1. The adapters: `beacon-http`, `beacon-browser`, `beacon-service-worker`, `beacon-app-store`, `beacon-google-play`, `beacon-expo`, `beacon-code-push`, `beacon-device-info` and `beacon-firebase-remote-config`.
2. The framework bindings: `beacon-react` first, since it is the one this project is for, then `beacon-vue`, `beacon-solid` and `beacon-svelte`.
3. `beacon-devtools` last. It has the React binding as an optional peer, and an application that installs both must find both.

No package has a runtime dependency, so no other order constraint exists: the SDKs of the adapters (`expo-updates`, `react-native-device-info`, the CodePush forks, `@react-native-firebase/remote-config`, `firebase`) are optional peers the application installs, and an adapter never imports one.

## What is checked, and where

| Check                                                                                                                                         | Command                                                                             | Runs in                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| Build, typecheck, lint, tests under Node and a Hermes-like runtime                                                                            | `pnpm check`                                                                        | `packages-test` on Node 22.18.0 and 24        |
| Mutants of the guarded rules                                                                                                                  | `pnpm test:mutation`                                                                | `packages-test`                               |
| Formatting                                                                                                                                    | `pnpm lint:prettier`                                                                | `common-format`                               |
| The rules of the release gate, then the gate                                                                                                  | `pnpm test:release`, `pnpm verify:release`                                          | `packages-verify`                             |
| Pack, publint, attw, tarball contents, checksums                                                                                              | `pnpm test:package`                                                                 | `packages-verify`                             |
| The tarballs installed and used in clean consumers (no workspace)                                                                             | `pnpm test:consumers`                                                               | `packages-verify`                             |
| Documentation: pages, snippets, JSDoc examples, links, the site build                                                                         | `pnpm verify:docs`, `verify:snippets`, `verify:jsdoc`, `verify:links`, `build:docs` | `docs-test`                                   |
| Chromium: the release lab in every web binding, the Expo web export, the browser package, the triggers, and Metro bundles for iOS and Android | `pnpm test:browser`, `pnpm --filter example-expo build:native`                      | `browser-test`                                |
| The oldest and newest SDK each adapter claims                                                                                                 | `pnpm verify:peers`                                                                 | `packages-peers`, weekly and before a release |

`pnpm check:release` runs all of them that need no browser, in the order a release needs them, and `pnpm test:browser` is separate because it needs Chromium (`pnpm exec playwright install chromium`). The consumers need the network. The publish workflow runs every workflow above and publishes only if all pass.

`pnpm test:consumers` installs the tarballs staged by `pnpm test:package` into folders outside the repository, and fails with the install's own error if a peer range cannot be met: a Vite and React 19 app (compiled under `bundler`, `node16` and `nodenext` on three TypeScript versions, built by Vite, run under Node), the same on React 18.3, an Expo app with the real `expo-updates` (compiled, then bundled by Metro for both native platforms), the adapters over the real SDKs, Vue, Solid and Svelte, an adapter author's Vitest project running the conformance suites, and a Jest test through the provider. `BEACON_CONSUMER_DIR=<folder>` keeps them in a folder you choose, and `BEACON_KEEP_CONSUMERS=1` keeps the default one, to look into a failure.

## Prepare a release

1. Move every package to the version with `pnpm release:version <version>`. It sets the version of all fifteen manifests and the peer range of every package on another, which for `0.2.0` is `>=0.2.0 <0.3`. A minor bump of a `0.x` line has to change those ranges, since `^0.1.0` means `>=0.1.0 <0.2.0` and a dependent that kept it cannot be installed beside the new core; `verify:release` fails when one did not. A prerelease such as `0.2.0-next.1` gets a floor of `>=0.2.0-0`, because it sorts below `0.2.0`.
2. Add one `## <package> <version> - <date>` heading to `CHANGELOG.md` for each package, and date it (`YYYY-MM-DD`): `Unreleased` blocks a release, and `verify:release` parses the heading literally. A first release reads as the state of the package, never as the history of how it was built.
3. Run `pnpm check:release`, then `pnpm test:browser`. Run `pnpm verify:peers` too: it needs the network, and `packages-peers` runs it again in the workflow.
4. Merge into `main` and check GitHub Actions on that revision.
5. Create a GitHub release with the package's tag, once per package, in the order above. Mark prerelease versions as prereleases: the workflow refuses a flag that disagrees with the version.
6. Approve the publish job in the GitHub `npm` environment once its verification jobs pass.

Do not reuse a published version. Prepare a new patch version and changelog entry for a release fix. A publish that finds the exact verified tarball already on npm succeeds without publishing again, so a failed run can be re-run; one that finds a different tarball under the same version fails.

A version that turns out to be wrong is deprecated with `npm deprecate`, and a fix is published as the next patch. Nothing is unpublished, and deleting a GitHub release does not unpublish anything.

## What the release checks do not cover

No adapter runs on a device. In a real browser only Chromium runs, under Playwright in continuous integration: the example apps over a scripted release lab, and the browser package's storage and build reader. Metro bundles the Expo example for iOS and Android, and a device still has to run it. [The decision record](docs/decisions.md) lists what that leaves unverified. Before a stable release of an adapter, run it once by hand in a real application on each platform it maps, and say in the release notes what you ran.

## npm trusted publishers

All packages use the GitHub owner `priemskiyyy`, repository `beacon`, workflow `publish.yml` and environment `npm`. Trusted publishing uses GitHub's short-lived OIDC identity, so the repository needs no npm token. The registry settings are in [.github/REPOSITORY_SETUP.md](.github/REPOSITORY_SETUP.md).

The first publication of a new package requires an authenticated npm maintainer, because the package must exist before its trusted publisher can be configured. Publish the verified tarballs from their artifact directories, the core first, then register the workflow for each. Do not create a GitHub release for that same version afterward. A manual publication carries no provenance attestation, which is why the first version is the one without.

```sh
pnpm build && pnpm test:package && pnpm test:consumers
npm login
for package in beacon beacon-http beacon-browser beacon-service-worker beacon-app-store beacon-google-play beacon-expo beacon-code-push beacon-device-info beacon-firebase-remote-config beacon-react beacon-vue beacon-solid beacon-svelte beacon-devtools; do
  (cd ".artifacts/release/@priemskiyyy/$package" && shasum -a 256 -c SHA256SUMS && npm publish ./*.tgz --access public --tag latest)
done
```

After the publish, register the trusted publisher of each package, then require two-factor authentication and disallow tokens for it. The workflow publishes through OIDC, which that setting does not affect. `npm trust` needs npm 11.15 or later. Older versions leave out the permission the registry requires and fail with a bare `400 Bad Request`.

```sh
for package in beacon beacon-http beacon-browser beacon-service-worker beacon-app-store beacon-google-play beacon-expo beacon-code-push beacon-device-info beacon-firebase-remote-config beacon-react beacon-vue beacon-solid beacon-svelte beacon-devtools; do
  npm trust github "@priemskiyyy/$package" --file publish.yml --repository priemskiyyy/beacon --environment npm --allow-publish
  npm access set mfa=publish "@priemskiyyy/$package"
done
```
