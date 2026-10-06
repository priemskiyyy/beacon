---
description: "What the tests prove about Beacon, how the scenario table is read from them, and what only a real browser or device can verify."
---

# Verification

The specification lists 202 required regression scenarios in 14 groups, and the triggers of the core (`@priemskiyyy/beacon/triggers`) add the group `TRIG`, which is its own and not the specification's. A test is named after the row it proves, such as `SAFE-03`, and one row can have several tests. A type-level row is proven by a `*.contracts.ts` file that carries the row's marker, and a build-level or documentation row by a script that does; a documentation row is a declared limit that `scripts/verify-limits.mjs` keeps in [the limits](limits.md). `pnpm test:package` checks that a built package imports only what its role allows. The table below is read from the tests, contract files and scripts by `scripts/verify-scenarios.mjs`, which fails when it disagrees with them or when a test names a row that does not exist. It counts rows with a test, not rows a device has passed.

<!-- scenarios:start -->

| Group   | Covers                              | Specified | Proven | Rows proven                                                                                                            |
| ------- | ----------------------------------- | --------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| CORE    | Core state and observations         | 14        | 14     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14                                                                 |
| VER     | Identity, ordering, and revision    | 18        | 18     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18                                                 |
| HTTP    | HTTP, manifests, and shared feeds   | 18        | 17     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12, 13, 14, 15, 16, 17, 18                                                     |
| POL     | Support policy                      | 14        | 13     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 13, 14                                                                     |
| WEB     | Browser reload and deployment       | 12        | 10     | 01, 02, 03, 04, 06, 07, 09, 10, 11, 12                                                                                 |
| SW      | Service-worker and Workbox          | 16        | 13     | 01, 02, 03, 04, 05, 07, 08, 09, 12, 13, 14, 15, 16                                                                     |
| EXPO    | Expo Updates                        | 20        | 16     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 16, 17, 18, 19, 20                                                         |
| PLAY    | Google Play native flows            | 18        | 17     | 01, 02, 03, 04, 05, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18                                                     |
| STORE   | App Store metadata and handoff      | 10        | 9      | 01, 02, 03, 04, 05, 06, 07, 08, 09                                                                                     |
| SAFE    | Disruption coordination             | 14        | 14     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14                                                                 |
| JOURNAL | Persistence and boot reconciliation | 14        | 14     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14                                                                 |
| LIFE    | Sessions and resource ownership     | 12        | 12     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12                                                                         |
| SEC     | Security and diagnostics            | 12        | 11     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12                                                                             |
| BIND    | Types, React, and SSR               | 10        | 10     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10                                                                                 |
| TRIG    | Triggers and checks on events       | 30        | 30     | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 |
| Total   |                                     | 232       | 218    |                                                                                                                        |

<!-- scenarios:end -->

## What the tests are

Every provider SDK, the clock and the network are faked in process. The Expo (Updates and `expo-application`), CodePush, Firebase Remote Config and device info adapters are also typechecked against the real SDK's types, in `*.contracts.ts` files that prove the structural types the adapters use are satisfied by the real modules. The triggers are typechecked against the real `AppState`, NetInfo and Pulse, and run against the real Pulse over its own mock adapter. A contract file is typechecked and never run.

## What they are not

Nothing has run on a device, against a real Play or App Store distribution, or against a Firebase project, and a fake bridge verifies state handling, not installation. A real browser has run two things, Chromium under Playwright: the example apps over a scripted release lab, and the browser package's `browserStorage` and `webBuild`. What a stable release of each adapter still needs is in [the decision record](decisions.md#not-verified-on-a-device).

The rows without a test belong to features that are not built yet, such as the dismissal of a banner (`POL-12`), or need a device or a real distribution to prove. [The decision record](decisions.md#not-built-yet) lists them.
