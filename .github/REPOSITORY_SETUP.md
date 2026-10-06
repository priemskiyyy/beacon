# Repository setup

The repository is [priemskiyyy/beacon](https://github.com/priemskiyyy/beacon). These settings complement the files checked into the project. Adding the files enables none of them, and nothing here can be done from a workflow: each is a click or a command by someone with admin rights on the repository and ownership of the npm scope.

## Actions

1. In **Settings, Actions, General**, allow actions from GitHub and from `pnpm/action-setup`, and set the default workflow permissions to read repository contents. Every workflow here asks for `contents: read` and raises it only for the job that needs more: `id-token: write` for the npm publish and Pages deploy, `pages: write` for Pages.
2. No secret is needed. Publishing to npm and deploying Pages both use GitHub's short-lived OIDC identity, so the repository holds no `NPM_TOKEN`. If one ever appears in the secrets list, it is not used by any workflow and should be deleted.

## Documentation

1. Select **GitHub Actions** as the Pages source in **Settings, Pages**.
2. Run the `docs-deploy` workflow once the documentation is on `main`. It publishes through the `github-pages` environment that GitHub creates for Pages.
3. Check the deployed site at `https://priemskiyyy.github.io/beacon/`: its canonical URLs, its sitemap, its 404 page, its mobile navigation and a code group.
4. Add the live documentation URL to the repository's About section. Every package's `homepage` points at it.

The deployment workflow builds the site for `https://priemskiyyy.github.io/beacon/` (`DOCS_SITE_URL` and `DOCS_BASE_PATH` are set in `docs.deploy.yml`) and checks the links of that build on every push to `main`, so the base path is proved whether or not Pages is on yet. Only the deployment needs Pages: it is skipped for a private repository, and fails until GitHub Actions is the Pages source. For another host or another repository name, change those two variables, and every package's `homepage` with them. `pnpm build:docs` with neither set builds for `/`, which is what `pnpm dev:docs` and a local preview show.

## Still missing: a logo and a social image

The project has a favicon (`docs/public/beacon.svg`) and nothing else. There is no logo and no social preview image, so the documentation emits no `og:image`. When an image exists:

1. Add a 1200 by 630 PNG under `docs/public/`.
2. Emit `og:image` and `og:image:alt` from `docs/.vitepress/config.ts`, using the deployed site URL.
3. Upload the same image as the repository's social preview, in the General settings. GitHub uses that setting independently of the site's metadata.

## Discovery

Use a concise About description and topics that match the packages. Suggested topics: `release-management`, `app-updates`, `ota-updates`, `force-update`, `expo`, `expo-updates`, `react-native`, `react`, `typescript`, `service-worker`, `code-push`, `firebase-remote-config`.

## Contributions

- Issue forms and the pull request template are in `.github`.
- Enable private vulnerability reporting in the Security settings: [SECURITY.md](../SECURITY.md) sends reports to it, so it has to be on for the link to work.
- Configure a ruleset for `main` after the required checks have run once. The checks are named for their workflow, so the names below are the ones to require: `packages-test (22.18.0)`, `packages-test (24)`, `packages-verify`, `common-format`, `docs-test` and `browser-test`. `packages-peers` needs the network and the SDKs' registries, so it runs weekly and before a release and is better not required.
- Require a pull request, linear history and no force pushes, and do not allow bypass.

## Releases

Follow [RELEASING.md](../RELEASING.md) for the order, the checks and the first publication. The settings it relies on:

1. **The npm scope.** `@priemskiyyy` must be owned by the account that publishes the first version of each package. The fifteen names are free on the registry as of this writing, and the scope's other packages (`flare`, `pulse`) were published by hand, so the first publication of each Beacon package is manual too.
2. **The `npm` environment.** Create it in **Settings, Environments** with at least one required reviewer, and allow deployments from tags only (a `*-v*` pattern), since a release runs the workflow on its tag. The publish job waits for that approval, and no job that holds `id-token: write` runs without it.
3. **Trusted publishing.** After a package's first version exists, register the workflow for it: owner `priemskiyyy`, repository `beacon`, workflow `publish.yml`, environment `npm`. RELEASING.md has the `npm trust` command, which needs npm 11.15 or later. Provenance is then attached to every later publish, and it requires the repository to be public and `repository.url` to match it, which `pnpm verify:release` checks.
4. **Two-factor authentication.** Require it for publishing on each package and disallow tokens. The workflow publishes through OIDC, which that setting does not affect.
5. **Release notes.** A GitHub release is created per package from its tag, and its text is the package's changelog entry. A release marked as a prerelease must carry a prerelease version, and the other way round.

## Dependency updates

Nothing here updates the pinned dependencies by itself. Review the lockfile before a release (`pnpm install --frozen-lockfile` must be clean, and `pnpm audit --prod` has no finding in anything a package ships, which is nothing, since no package has a runtime dependency), and run `pnpm verify:peers` when an SDK a structural type reads has a new release.
