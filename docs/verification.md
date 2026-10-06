# Verification

The specification lists 202 required regression scenarios in 14 groups. A test is named after the row it proves, such as `SAFE-03`, and one row can have several tests. A type-level row is proven by a `*.contracts.ts` file that carries the row's marker, and a build-level or documentation row by a script that does; a documentation row is a declared limit that `scripts/verify-limits.mjs` keeps in [the limits](limits.md). `pnpm test:package` checks that a built package imports only what its role allows. The table below is read from the tests, contract files and scripts by `scripts/verify-scenarios.mjs`, which fails when it disagrees with them or when a test names a row that does not exist. It counts rows with a test, not rows a device has passed.

<!-- scenarios:start -->

| Group   | Covers                              | Specified | Proven | Rows proven                                                            |
| ------- | ----------------------------------- | --------- | ------ | ---------------------------------------------------------------------- |
| CORE    | Core state and observations         | 14        | 14     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14                 |
| VER     | Identity, ordering, and revision    | 18        | 18     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18 |
| HTTP    | HTTP, manifests, and shared feeds   | 18        | 17     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12, 13, 14, 15, 16, 17, 18     |
| POL     | Support policy                      | 14        | 13     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 13, 14                     |
| WEB     | Browser reload and deployment       | 12        | 10     | 01, 02, 03, 04, 05, 06, 07, 09, 11, 12                                 |
| SW      | Service-worker and Workbox          | 16        | 12     | 01, 02, 03, 04, 05, 07, 08, 09, 12, 13, 14, 16                         |
| EXPO    | Expo Updates                        | 20        | 16     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 16, 17, 18, 19, 20         |
| PLAY    | Google Play native flows            | 18        | 17     | 01, 02, 03, 04, 05, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18     |
| STORE   | App Store metadata and handoff      | 10        | 9      | 01, 02, 03, 04, 05, 06, 07, 08, 09                                     |
| SAFE    | Disruption coordination             | 14        | 14     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14                 |
| JOURNAL | Persistence and boot reconciliation | 14        | 14     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14                 |
| LIFE    | Sessions and resource ownership     | 12        | 12     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12                         |
| SEC     | Security and diagnostics            | 12        | 11     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12                             |
| BIND    | Types, React, and SSR               | 10        | 10     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10                                 |
| Total   |                                     | 202       | 187    |                                                                        |

<!-- scenarios:end -->

## What the tests are

Every provider SDK, the clock and the network are faked in process. The Expo Updates and React Native adapters are also typechecked against the real SDK's types, in `*.contracts.ts` files that prove the structural types the adapters use are satisfied by the real modules. A contract file is typechecked and never run.

## What they are not

Nothing has run in a real browser, on a device, or against a real Play or App Store distribution, and a fake bridge verifies state handling, not installation. What a stable release of each adapter still needs is in [the decision record](decisions.md#not-verified-on-a-device).

The groups with few or no proven rows are features that are not built yet: the dismissal of a banner (`POL`), and the parts of `HTTP`, `SEC` and `BIND` that belong to a standard manifest, the diagnostics inspector and the other framework bindings. [The decision record](decisions.md#not-built-yet) lists them.
