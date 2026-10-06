# Releasing the packages

All packages share one version line, and each has its own GitHub release tag. Pushes and verification runs publish nothing.

The release tag uses the package name without its scope: `<name>-v<version>`, for example `beacon-expo-v0.1.0` for `@priemskiyyy/beacon-expo`, and `beacon-v0.1.0` for the core. Prereleases use the `next` dist-tag, and stable releases use `latest`.

Publish `@priemskiyyy/beacon` first, then the adapters, then `@priemskiyyy/beacon-react`. Dependents declare the matching minor as a peer dependency, so a dependent published before the core cannot be installed.

## Prepare a release

1. Update the package versions and their entries in `CHANGELOG.md` together. Date the entries, because `Unreleased` marks a release that is not ready.
2. Run `pnpm check`. It needs no device, no credentials and no browser.
3. Merge into `main` and check GitHub Actions on that revision.
4. Create a GitHub release with the package's tag. Mark prerelease versions as prereleases.

Do not reuse a published version. Prepare a new patch version and changelog entry for a release fix.

## What the release checks do not cover

No adapter runs on a device or in a real browser, in continuous integration or anywhere else in this repository. [The decision record](docs/decisions.md) lists what that leaves unverified. Before a stable release of an adapter, run it once by hand in a real application on each platform it maps, and say in the release notes what you ran.
