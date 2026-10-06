---
description: "Write the application's own support policy with supportPolicy, read what Beacon publishes when support is unknown, deprecated or ended, and order versions with the strategies."
---

# Support

Support answers a different question than an update does. An update asks whether something newer exists. Support asks whether what runs is still acceptable to you. A build can be current and unsupported, or old and supported.

Beacon does not decide it. You write the policy, Beacon evaluates it against what runs, keeps the verdict beside its evidence, and never lets a failure invent one.

## A policy

`supportPolicy({ source, evaluate })` takes a view of a source's document and a pure function of that view and the running facts. The standard manifest of the [HTTP adapter](http.md) carries a denylist for this purpose, and the example reads it. A minimum build kept in Firebase Remote Config is read the same way: see [Firebase Remote Config](firebase-remote-config.md).

```ts
import { Beacon, supportPolicy, targetRoute } from "@priemskiyyy/beacon";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

declare const __BUILD_ID__: string;

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

const routes = { web: { kind: "target" } } satisfies RouteDeclarations;

const manifest = http({
  fetch: async ({ scope, signal }) =>
    readStandardManifest({
      response: await fetch("/releases.json", { signal }),
      scope,
      routes,
      now: Date.now(),
    }),
});

const policy = supportPolicy({
  source: manifest.select((document) => document.support),
  evaluate: (support, running) => {
    if (support === null) {
      return { status: "supported", reasons: [], remediation: [] };
    }

    const { web } = running;

    if (web.state !== "known") {
      return {
        status: "unknown",
        reasons: [{ code: "web-build-not-read", subject: "web" }],
        remediation: [],
      };
    }

    const { identity } = web.release;

    if (
      identity.status === "known" &&
      support.deniedReleaseIds.includes(identity.value)
    ) {
      return {
        status: "unsupported",
        reasons: [{ code: support.reasonCode, subject: support.subject }],
        remediation: [{ route: support.remediationRoute, level: "required" }],
      };
    }

    return { status: "supported", reasons: [], remediation: [] };
  },
});

export const beacon = new Beacon({
  scope,
  running: {
    web: webBuild({ authority: scope.application, id: __BUILD_ID__ }),
  },
  routes: {
    web: targetRoute({
      source: manifest.select((document) => document.routes.web),
      mechanism: browserReload(),
    }),
  },
  policy,
});
```

The policy shares the manifest's one read with the route. A remediation names a route of this Beacon, and a route it does not have fails to compile. If it arrives from untyped code, the policy fails with `POLICY_FAILED` and no command is created.

`evaluate` is synchronous and pure. It cannot fetch, open a modal, start a download or import code. It must handle a subject that is not `known`, because that is never version zero. It answers a verdict:

| Field         | Meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `status`      | `unknown`, `supported`, `deprecated` or `unsupported`                                 |
| `reasons`     | codes of your own, each with the running subject it is about, or `null`               |
| `remediation` | routes that would satisfy the policy, each `required`, `recommended` or `alternative` |

Support is not installation eligibility, compatibility, or whether an advertised release is newer.

## What Beacon publishes

`beacon.support` is an observable of one state.

```ts
const { status, reason, evaluation, error } = beacon.support.get();

if (status === "unsupported" && evaluation !== null) {
  const codes = evaluation.reasons.map((entry) => entry.code);
  const usable = evaluation.remediation.filter((entry) => entry.usable);

  console.info(codes, usable.length);
}
```

| Field        | Meaning                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `status`     | what is in force                                                                                                       |
| `reason`     | why `status` is `unknown` when Beacon reached that itself, else `null`                                                 |
| `evaluation` | the last evaluation: status, reasons, remediation, the running revision it was reached under, and its evidence         |
| `error`      | the failure of the latest evaluation, kept beside the last valid one, or of the last read when it left support unknown |

Each remediation in an evaluation adds `usable`: its route has an offer or a prepared target now. A route with nothing usable is honest information, not an error.

### When support is unknown

`unknown` is what support is until a policy is accepted, and it is never `supported` by default. `not-checked` means only that no check has run: a check that ran and failed says so.

| `reason`            | Means                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-policy`         | the Beacon has no policy                                                                                                                        |
| `not-checked`       | no check has run yet                                                                                                                            |
| `read-failed`       | the last read of the policy's source failed and nothing is in force: `error` says why, and the last evaluation, if there is one, is kept beside |
| `expired`           | the accepted policy lapsed, and its last evaluation is kept beside                                                                              |
| `evaluation-failed` | the policy could not be evaluated                                                                                                               |

An `unknown` that your policy answered has none of these, and carries its own reasons in the evaluation.

### What never changes it

- A failed check never turns `supported` into `unsupported`. The check says `failed` and the verdict stays.
- A policy that throws keeps the last valid evaluation in force and reports the failure in `error`.
- A read of the policy's source that fails while an evaluation still holds changes nothing: the evaluation stays in force until it lapses, and then support says `read-failed` instead of `expired`, with that evaluation beside it.
- A policy that lapses becomes `unknown` with the last decision kept beside it, and a restart does not renew it.
- A requirement is satisfied only by newly observed running facts or a new accepted policy. Opening a store, downloading an update or a provider's consent does not lift it.
- A dismissal never changes it. Dismissals are not stored yet; see [decisions](decisions.md).

## When support ends

`unsupported` means the running build no longer meets your policy. What you do is yours. Two rules keep it honest.

1. Show the state as it is. If a `required` remediation is usable, offer it. If none is, show a screen that says so, with a retry and a restricted mode, and never answer with an endless redirect to the same store page.
2. Do not treat `unknown` as a verdict. A lapsed policy is `unknown` with its last decision beside it. Choosing a grace period for it is a decision for your application.

```ts
const { status, evaluation } = beacon.support.get();

if (status === "unsupported" && evaluation !== null) {
  const required = evaluation.remediation.filter(
    (entry) => entry.level === "required",
  );

  if (required.some((entry) => entry.usable)) {
    console.info("Offer the required update.");
  } else {
    console.info("Explain, and offer a retry.");
  }
}
```

[Recipes](recipes.md#forced-upgrade-when-support-ends) builds the full screen.

## Version strategies

A version strategy parses, orders and admits one domain of versions. `newerRoute` uses one, and so can a policy. They come from `@priemskiyyy/beacon/versions`.

| Strategy    | Domain                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `semver()`  | strict Semantic Versioning 2.0.0; rejects a leading `v` and every other near miss; ignores build metadata               |
| `integer()` | non-negative integers, as safe integers or canonical decimal strings, compared exactly beyond `Number.MAX_SAFE_INTEGER` |
| `custom()`  | a domain of your own, with a parser you validate                                                                        |

Each is a `VersionStrategy<TParsed, TInput>`:

- `parse(input)` is strict. It throws a `BeaconError` with `INVALID_VERSION` for input outside the domain, and never guesses.
- `compare(candidate, current)` is pure and answers `older`, `equal`, `newer` or `incomparable`. `incomparable` is an answer of its own, never read as equal, older or newer.
- `admits(candidate)` says whether a candidate may be offered at all, whatever its order. `semver()` excludes prereleases unless you pass `{ prereleases: "include" }`.

```ts
import { integer, semver } from "@priemskiyyy/beacon/versions";

const build = integer();

console.info(build.compare(build.parse(108), build.parse("112"))); // "older"

const strategy = semver({ prereleases: "include" });

console.info(
  strategy.compare(strategy.parse("2.4.0-beta.1"), strategy.parse("2.4.0")),
); // "older"
```

`integer()` rejects signs, fractions, exponents, leading zeros and whitespace, so `"007"` throws instead of becoming 7.

### A minimum native build

`minimumBuild` is the forced upgrade as a policy: the binary that runs is `unsupported` when its build number is below the minimum a source names. It reads the `native` running fact, so the application needs a native reader, such as the one in [React Native](react-native.md#what-the-binary-is).

```ts
import { createReleaseSource, minimumBuild } from "@priemskiyyy/beacon";

const catalog = createReleaseSource<{ minimumBuild: number }>({
  name: "support-catalog",
  read: async () => ({ document: { minimumBuild: 112 } }),
});

export const minimum = minimumBuild({
  source: catalog.select((document) => document.minimumBuild),
  remediation: "binary",
});
```

The minimum is text or a number, such as a Remote Config parameter, and `remediation` names the route that sends an older build to the store, a route of the same Beacon, which a route it does not have fails to compile. Leave it out when the screen opens the store itself, and `level: "recommended"` makes that route a recommendation where `required` is the default. The verdict is one of these, and never a guess:

| When                                                                                                                                       | Status        | Reason code               |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------- |
| the `native` fact is `pending`, `failed` or `unconfigured`                                                                                 | `unknown`     | `native-build-not-read`   |
| its identity is unknown, is not named in `android-version-code` or `ios-build`, or is of another application than the `authority` you give | `unknown`     | `native-build-unreadable` |
| the build is below the minimum                                                                                                             | `unsupported` | `native-build-too-old`    |
| the build is at the minimum or above it                                                                                                    | `supported`   |                           |

It reads the build from the identity of the release, which is the same on both platforms, and so is right for an iOS build number as well as for an Android version code. Both sides are compared as whole numbers with `integer()`, so a minimum or a build that is not one, such as a dotted `1.2.0`, fails the evaluation of the policy with `INVALID_VERSION`, and not the read of the source, which has succeeded: support is `unknown` with the reason `evaluation-failed` and the failure in `error`, or, when an earlier evaluation was valid, that one stays in force beside the error. `authority: scope.application` is for a reader of your own that does not check the application id itself: a binary of another application, such as Expo Go running your code, is then unknown and never a build below the minimum. A store's marketing version never satisfies a build-level minimum; see [App Store](app-store.md).

The three words an identity's `domain` takes here, and in the readers and the sources that agree with them, are constants of the core: `ANDROID_VERSION_CODE_DOMAIN`, `IOS_BUILD_DOMAIN` and `WEB_ARTIFACT_DOMAIN`.

The codes `native-build-not-read`, `native-build-unreadable` and `native-build-too-old` are named by `minimumBuild`, and, like `web-build-not-read` in the first policy above, are the names of a policy's verdicts. They are not reader reasons: a reader that could not read a build says `build-not-read` in the identity, and [Native build](native.md#what-it-reports) lists the reasons it has.

### A domain of your own

```ts
import { BeaconError } from "@priemskiyyy/beacon";
import { custom } from "@priemskiyyy/beacon/versions";

type Calendar = { year: number; month: number };

export const calendar = custom<Calendar, string>({
  name: "calendar-version",
  parse: (input) => {
    const match = /^(\d{4})\.(\d{2})$/.exec(input);

    if (match === null) {
      throw new BeaconError({
        code: "INVALID_VERSION",
        message: `"${input}" is not a calendar version.`,
      });
    }

    return { year: Number(match[1]), month: Number(match[2]) };
  },
  compare: (candidate, current) => {
    if (candidate.year !== current.year) {
      return candidate.year > current.year ? "newer" : "older";
    }

    if (candidate.month === current.month) {
      return "equal";
    }

    return candidate.month > current.month ? "newer" : "older";
  },
});
```

When a route runs a strategy, a parser that throws anything but a `BeaconError` fails the check with `SELECTION_FAILED` and your error as the cause. Run `testVersionStrategy` from `@priemskiyyy/beacon/testing` over a strategy of your own; see [testing](testing.md).

## Identities

`compareIdentities(left, right)` relates two release identities without guessing. It is what routes use, and it is public for a policy.

```ts
import { compareIdentities } from "@priemskiyyy/beacon";
import type { ReleaseIdentity } from "@priemskiyyy/beacon";

const running: ReleaseIdentity = {
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value: "web-build-a",
};

const target: ReleaseIdentity = { ...running, value: "web-build-b" };

console.info(compareIdentities(running, target)); // "different"
```

The answer is `same`, `different` or `incomparable`. Authority and domain are compared before the value, and an unknown identity is incomparable with everything, itself included.
