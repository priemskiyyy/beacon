// Mutation checks: each mutant weakens one rule the tests must defend. A
// survivor is either a missing test or dead code. Every changed file is
// restored, and a red baseline stops the run.
//
//   node scripts/mutate.mjs                        every mutant
//   node scripts/mutate.mjs --project expo         only the mutants of that vitest project
//   node scripts/mutate.mjs --project core --project expo
//
// `--project <name>` may be repeated. Only the baselines and the mutants of the
// named projects run, and a name no mutant belongs to is refused. The check
// that each `find` occurs exactly once in its file still covers every mutant.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const core = "packages/core/src/utils";
const mock = "packages/core/src/mock";
const testing = "packages/core/src/testing";
const http = "packages/adapters/http/src";
const triggers = "packages/core/src/triggers";
const devtools = "packages/devtools/src";
const expo = "packages/adapters/expo/src";
const appStore = "packages/adapters/app-store/src";
const googlePlay = "packages/adapters/google-play/src";

const MUTANTS = [
  {
    file: `${core}/Beacon.ts`,
    find: "this.#routes.reset();",
    replace: "",
    project: "core",
    describes: "a scope replacement keeping what the old scope taught",
  },
  {
    file: `${core}/Beacon.ts`,
    find: "this.#journal.reset();",
    replace: "",
    project: "core",
    describes: "a scope replacement keeping the journal of the old scope",
  },
  {
    file: `${core}/Beacon.ts`,
    find: "if (busy !== undefined) {",
    replace: "if (false) {",
    project: "core",
    describes: "a scope handed to an operation of another scope",
  },
  {
    file: `${core}/Beacon.ts`,
    find: "if (isSameData(this.#scope, next)) {",
    replace: "if (false) {",
    project: "core",
    describes: "an equal scope wiping what is known",
  },
  {
    file: `${core}/internal/runtime/BeaconRuntime.ts`,
    find: "this.#open(stop);\n  };",
    replace: "this.#open(() => {});\n  };",
    project: "core",
    describes:
      "a scope replacement restarting the session for a stop that nobody holds",
  },
  {
    file: `${core}/Beacon.ts`,
    find: "if (this.#routes.hasPolicy()) {\n      return RUNNING_SUBJECTS;",
    replace: "if (false) {\n      return RUNNING_SUBJECTS;",
    project: "core",
    describes:
      "a check with a support policy starting its reads before every running fact is in",
  },
  {
    file: `${core}/minimumBuild.ts`,
    find: 'if (native.state !== "known") {',
    replace: "if (false) {",
    project: "core",
    describes: "a forced upgrade reading a native build that was not read",
  },
  {
    file: `${core}/minimumBuild.ts`,
    find: "identity.domain !== IOS_BUILD_DOMAIN) ||",
    replace: "false) ||",
    project: "core",
    describes:
      "a forced upgrade comparing a build named in a domain that is not a native build's",
  },
  {
    file: `${core}/minimumBuild.ts`,
    find: "(authority !== undefined && identity.authority !== authority)",
    replace: "false",
    project: "core",
    describes:
      "a forced upgrade comparing a build of another application than the one named",
  },
  {
    file: `${core}/minimumBuild.ts`,
    find: 'if (build.compare(build.parse(identity.value), minimum) !== "older") {',
    replace:
      'if (build.compare(build.parse(identity.value), minimum) === "older") {',
    project: "core",
    describes: "a forced upgrade answering supported for an older build",
  },
  {
    file: `${core}/minimumBuild.ts`,
    find: 'level = "required",',
    replace: 'level = "recommended",',
    project: "core",
    describes:
      "a forced upgrade whose store route is only recommended unless the application says so",
  },
  {
    file: `${core}/minimumBuild.ts`,
    find: "project: (document) => build.parse(source.project(document)),",
    replace: "project: (document) => String(source.project(document)),",
    project: "core",
    describes: "a forced upgrade reading a minimum that is not a whole number",
  },
  {
    file: `${core}/minimumBuild.ts`,
    find: "build.compare(build.parse(identity.value), minimum)",
    replace: "build.compare(identity.value, minimum)",
    project: "core",
    describes:
      "a forced upgrade comparing a build number that is not a whole number",
  },
  {
    file: `${core}/minimumBuild.ts`,
    find: "remediation === undefined ? [] : [{ route: remediation, level }],",
    replace: "[],",
    project: "core",
    describes: "a forced upgrade that names no route to send an older build to",
  },
  {
    file: `${core}/internal/running/getRealmBootId.ts`,
    find: "if (realmBootId === null) {",
    replace: "if (true) {",
    project: "core",
    describes:
      "a Beacon minting its own boot id where the realm has one for every Beacon",
  },
  {
    file: `${core}/internal/running/resolveRunningReaders.ts`,
    find: "boot: readers.boot ?? { id: getRealmBootId() }",
    replace: "boot: { id: getRealmBootId() }",
    project: "core",
    describes: "a boot id the application gave replaced by the realm's",
  },
  {
    file: `${core}/internal/running/RunningRegistry.ts`,
    find: "resolve(reader({ scope: this.#getScope() })),",
    replace: "resolve(reader()),",
    project: "core",
    describes: "a running reader asked without the scope of the read",
  },
  {
    file: `${core}/internal/running/resolveRunningReaders.ts`,
    find: "if (readers[subject] !== undefined) {",
    replace: "if (true) {",
    project: "core",
    describes: "a feed route whose subject has no reader being built",
  },
  {
    file: `${core}/internal/running/resolveRunningReaders.ts`,
    find: 'if (definition.kind !== "feed") {',
    replace: "if (false) {",
    project: "core",
    describes:
      "a driver route asked for a reader of its subject it never needed",
  },
  {
    file: `${core}/internal/running/resolveRunningReaders.ts`,
    find: "if (explicit !== undefined) {",
    replace: "if (false) {",
    project: "core",
    describes:
      "a driver's reader of its subject replacing the one the application passed",
  },
  {
    file: `${core}/internal/running/resolveRunningReaders.ts`,
    find: "if (second !== undefined) {",
    replace: "if (false) {",
    project: "core",
    describes:
      "two drivers supplying one subject and Beacon choosing one of them",
  },
  {
    file: `${core}/internal/running/resolveRunningReaders.ts`,
    find: "resolved[subject] = first.reader;",
    replace: "",
    project: "core",
    describes:
      "a driver's reader of its own subject ignored when the application passes none",
  },
  {
    file: `${testing}/testRunningReader.ts`,
    find: "return reader({ scope: Object.freeze({ ...scope }) });",
    replace: "return reader({ scope });",
    project: "core",
    describes:
      "a running reader that changes its scope passing its conformance suite",
  },
  {
    file: `${testing}/testRunningReader.ts`,
    find: "const read = situation.scope ?? scope;",
    replace: "const read = scope;",
    project: "core",
    describes:
      "a running reader situation read under another scope than its own",
  },
  {
    file: `${core}/targetRoute.ts`,
    find: "running: readRunningRelease(running, mechanism.subject),",
    replace: 'running: readRunningRelease(running, "web"),',
    project: "core",
    describes:
      "a target route comparing an offer with another subject than its mechanism names",
  },
  {
    file: `${core}/newerRoute.ts`,
    find: "const release = readRunningRelease(running, mechanism.subject);",
    replace: 'const release = readRunningRelease(running, "web");',
    project: "core",
    describes:
      "a newer route ordering a candidate against another subject than its mechanism names",
  },
  {
    file: `${core}/internal/routes/RouteRegistry.ts`,
    find: "subject: definition.mechanism.subject,",
    replace: 'subject: "web",',
    project: "core",
    describes:
      "a command of a feed route journaled against another subject than its mechanism names",
  },
  {
    file: `${testing}/testUpdateMechanism.ts`,
    find: "expect(RUNNING_SUBJECTS).toContain(create().mechanism.subject);",
    replace: "expect(create().mechanism.subject).toBeDefined();",
    project: "core",
    describes:
      "a mechanism that names no running subject passing its conformance suite",
  },
  {
    file: `${core}/Beacon.ts`,
    find: "if (this.#isDisposed()) {\n      throw createDisposedError();\n    }\n\n    return this.#journal.reportReady(checkpoint);",
    replace: "return this.#journal.reportReady(checkpoint);",
    project: "core",
    describes:
      "a checkpoint nothing recorded answered as recorded after dispose",
  },
  {
    file: `${core}/internal/observable/commitChange.ts`,
    find: "  try {\n    apply(transaction);\n  } finally {\n    transaction.commit();\n  }",
    replace: "  apply(transaction);\n  transaction.commit();",
    project: "core",
    describes:
      "a change that throws leaving stores set that nobody was told of",
  },
  {
    file: `${core}/internal/reads/SharedRead.ts`,
    find: "this.#fail(flight, toBeaconError(cause, errors.failed), cause);\n\n      return;",
    replace: "throw cause;",
    project: "core",
    describes: "a host clock that refuses a timer rejecting the check",
  },
  {
    file: `${core}/internal/feeds/FeedRecord.ts`,
    find: "    } catch {\n      return this.#expire(accepted);\n    }",
    replace: "    } catch {\n      return accepted;\n    }",
    project: "core",
    describes: "a document whose expiry nobody watches staying fresh",
  },
  {
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: 'if (this.#options.journal.state.get().journal !== "off") {',
    replace: "if (false) {",
    project: "core",
    describes: "an intent naming what ran before its reader answered",
  },
  {
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: 'if (this.#options.journal.state.get().journal !== "off") {',
    replace: "if (true) {",
    project: "core",
    describes:
      "a command waiting for a reader on behalf of a journal that is off",
  },
  {
    file: `${core}/internal/feeds/FeedRecord.ts`,
    find: "    this.#accepted = null;\n    this.#failure = null;\n  };",
    replace: "    this.#failure = null;\n  };",
    project: "core",
    describes: "a revision high-water mark carried into another scope",
  },
  {
    file: `${core}/internal/policy/PolicyRecord.ts`,
    find: "this.#lastValid = null;\n    this.#install(",
    replace: "this.#install(",
    project: "core",
    describes:
      "the last valid support of one scope kept beside a failure of the next",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "this.#hydrated = false;\n    this.#publish({",
    replace: "this.#publish({",
    project: "core",
    describes: "the record of the next scope never read",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "    this.#transitions = [];\n    this.#hydrated = false;",
    replace: "    this.#hydrated = false;",
    project: "core",
    describes: "the intents of the last scope shown for the next",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "return await Promise.race([answer, expired.promise]);",
    replace: "return await answer;",
    project: "core",
    describes: "a journal storage that never answers holding every command",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "} finally {\n      cancel();",
    replace: "} finally {",
    project: "core",
    describes: "a journal deadline that outlives the call it bounded",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "if (!abandoned) {",
    replace: "if (false) {",
    project: "core",
    describes: "an answer within its deadline counted as late",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: '      this.#hydrated = true;\n      this.#publish({ journal: "ready" });',
    replace: '      this.#publish({ journal: "ready" });',
    project: "core",
    describes: "a cleared record still refused to a journal whose read failed",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: '      this.#hydrated = true;\n      this.#publish({ journal: "ready" });',
    replace: "      this.#hydrated = true;",
    project: "core",
    describes:
      "a cleared record that leaves a degraded journal saying degraded",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "      if (claim.generation !== this.#generation) {\n        return;\n      }\n\n      this.#hydrated = true;",
    replace: "      this.#hydrated = true;",
    project: "core",
    describes: "the record of a scope that ended vouching for the next one",
  },
  {
    file: `${core}/createBootId.ts`,
    find: "return (byte & 0x3f) | 0x80;",
    replace: "return byte & 0x3f;",
    project: "core",
    describes: "a boot id that is not a version 4 UUID",
  },
  {
    file: `${core}/createBootId.ts`,
    find: "Math.floor(Math.random() * 256)",
    replace: "Date.now() % 256",
    project: "core",
    describes: "a boot id that reads the host clock",
  },
  {
    file: `${core}/createBootId.ts`,
    find: "  } catch {\n    // A host whose source refuses is one that has none: the next source is as unique.\n  }",
    replace: "  } finally {\n    // nothing\n  }",
    project: "core",
    describes: "a host whose random source refuses failing to make a boot id",
  },
  {
    file: `${core}/Beacon.ts`,
    find: "return this.#clock;",
    replace: "return createSystemClock();",
    project: "core",
    describes: "a Beacon that answers a clock it does not run on",
  },
  {
    file: `${core}/parseUtcTimestamp.ts`,
    find: "new Date(milliseconds).toISOString().slice(0, SECONDS_LENGTH) !== seconds",
    replace: "false",
    project: "core",
    describes: "a UTC timestamp of a date that does not exist rolled over",
  },
  {
    file: `${core}/parseUtcTimestamp.ts`,
    find: "    Number.isNaN(milliseconds) ||\n",
    replace: "",
    project: "core",
    describes: "a UTC timestamp the engine cannot read thrown at the caller",
  },
  {
    file: `${core}/parseUtcTimestamp.ts`,
    find: '.padEnd(3, "0")',
    replace: '.padStart(3, "0")',
    project: "core",
    describes: "a fraction of a second read as a smaller one",
  },
  {
    file: `${core}/parseUtcTimestamp.ts`,
    find: "(?:\\.\\d{1,3})?Z$/;",
    replace: "(?:\\.\\d{1,9})?Z$/;",
    project: "core",
    describes: "a fraction finer than a millisecond read as a timestamp",
  },
  {
    file: `${mock}/createGate.ts`,
    find: "        resolve();\n",
    replace: "",
    project: "core",
    describes: "a released gate that keeps its waiters",
  },
  {
    file: `${mock}/createGate.ts`,
    find: "if (!state.held) {",
    replace: "if (true) {",
    project: "core",
    describes: "a held gate that lets a waiter through",
  },
  {
    file: `${mock}/createGate.ts`,
    find: "      state.held = false;\n",
    replace: "",
    project: "core",
    describes: "a released gate that stays closed to whoever comes next",
  },
  {
    file: `${mock}/settle.ts`,
    find: "setTimeout(resolve, 0);",
    replace: "resolve();",
    project: "core",
    describes: "a settle that returns before the queued continuations run",
  },
  {
    file: `${core}/keyValueJournalStorage.ts`,
    find: "if (kept === value) {",
    replace: "if (true) {",
    project: "core",
    describes: "a store that keeps nothing trusted to have kept the record",
  },
  {
    file: `${core}/keyValueJournalStorage.ts`,
    find: "if (!verify) {",
    replace: "if (false) {",
    project: "core",
    describes: "a write read back although the read back was turned off",
  },
  {
    file: `${core}/keyValueJournalStorage.ts`,
    find: "return text ?? null;",
    replace: "return text;",
    project: "core",
    describes: "a key the store answers undefined for read as a record",
  },
  {
    file: `${core}/keyValueJournalStorage.ts`,
    find: "await store.removeItem(toStoreKey(journalKey));",
    replace: "await store.removeItem(journalKey);",
    project: "core",
    describes: "a record removed under the journal's key, not the store's",
  },
  {
    file: `${core}/keyValueJournalStorage.ts`,
    find: "await store.setItem(storeKey, value);\n",
    replace: "store.setItem(storeKey, value);\n",
    project: "core",
    describes: "a write that resolves before the store answered it",
  },
  {
    file: `${mock}/createMockJournalStorage.ts`,
    find: "      await writeGate.wait();\n",
    replace: "",
    project: "core",
    describes: "a held write answered at once",
  },
  {
    file: `${mock}/createMockJournalStorage.ts`,
    find: "      await readGate.wait();\n",
    replace: "",
    project: "core",
    describes: "a held read answered at once",
  },
  {
    file: `${testing}/testRunningReader.ts`,
    find: ").toBe(text.trim());",
    replace: ").toBe(text);",
    project: "core",
    describes: "a running reader suite that lets a space around an identity by",
  },
  {
    file: `${testing}/testRunningReader.ts`,
    find: '.not.toBe("");',
    replace: ".toBe(text);",
    project: "core",
    describes: "a running reader suite that lets an empty identity part by",
  },
  {
    file: `${testing}/testRunningReader.ts`,
    find: "expect(reads()).toBe(0);",
    replace: "expect(reads()).toBeGreaterThanOrEqual(0);",
    project: "core",
    describes: "a running reader suite that lets a reader that is not cold by",
  },
  {
    file: `${testing}/testRunningReader.ts`,
    find: "expect(reads()).toBeGreaterThan(0);",
    replace: "expect(reads()).toBeGreaterThanOrEqual(0);",
    project: "core",
    describes:
      "a running reader suite that lets a count that is never wired by",
  },
  {
    file: `${testing}/testRunningReader.ts`,
    find: "expect(release.identity.status).toBe(situation.answers);",
    replace: "expect(release.identity.status).toBeDefined();",
    project: "core",
    describes:
      "a running reader suite that lets the wrong answer of a situation by",
  },
  {
    file: `${testing}/testJournalStorage.ts`,
    find: '.resolves.toBe("second");',
    replace: ".resolves.toBeDefined();",
    project: "core",
    describes:
      "a journal storage suite that lets a write that does not overwrite by",
  },
  {
    file: `${testing}/testJournalStorage.ts`,
    find: "        `${base}%2Fchild`,\n",
    replace: "",
    project: "core",
    describes: "a journal storage suite that lets two keys become one by",
  },
  {
    file: `${core}/internal/routes/claimExclusive.ts`,
    find: "claimed.delete(owner);",
    replace: "",
    project: "core",
    describes: "a native manager never given back",
  },
  {
    file: `${core}/internal/routes/DriverRoutes.ts`,
    find: "const release = claimExclusive(driver.exclusive);",
    replace: "const release = () => {};",
    project: "core",
    describes: "two sessions racing for one native manager",
  },
  {
    file: `${core}/internal/revisions/judgeRevision.ts`,
    find: 'if (ordering === "older") {',
    replace: "if (false) {",
    project: "core",
    describes: "a lower revision replacing a higher one",
  },
  {
    file: `${core}/internal/routes/RouteRegistry.ts`,
    find: "      // A listener told that a route opened may have ended the session: nothing else is opened for it.\n      if (!session.resources.isActive()) {",
    replace:
      "      // A listener told that a route opened may have ended the session: nothing else is opened for it.\n      if (false) {",
    project: "core",
    describes: "a route opened for a session a listener ended",
  },
  {
    file: `${core}/internal/routes/RouteRegistry.ts`,
    find: "    if (!session.resources.isActive()) {\n      return;\n    }\n\n    this.#feeds.resume(session);",
    replace: "    this.#feeds.resume(session);",
    project: "core",
    describes:
      "a document expiring while the session that would resume it ended",
  },
  {
    file: `${core}/internal/routes/RouteRecord.ts`,
    find: "if (isSameData(next, held)) {",
    replace: "if (false) {",
    project: "core",
    describes: "an install that changes nothing telling its listeners",
  },
  {
    file: `${core}/internal/reads/SharedRead.ts`,
    find: "if (own !== undefined && this.#isWaiting(own)) {",
    replace: "if (false) {",
    project: "core",
    describes: "a call that asks for a read joining the one it started twice",
  },
  {
    file: `${core}/internal/feeds/FeedRecord.ts`,
    find: "if (expiresAt !== null && !Number.isFinite(expiresAt)) {",
    replace: "if (false) {",
    project: "core",
    describes: "an expiry that is not a finite time held as a document's",
  },
  {
    file: `${core}/internal/disruptions/DisruptionRegistry.ts`,
    find: "        this.#release(held);\n",
    replace: "",
    project: "core",
    describes: "a blocked command leaving reservations held",
  },
  {
    file: `${core}/internal/disruptions/DisruptionRegistry.ts`,
    find: 'signal.addEventListener("abort", cancel, { once: true });',
    replace: "",
    project: "core",
    describes:
      "a settlement deadline that outlives the caller that stopped waiting",
  },
  {
    file: `${core}/internal/disruptions/DisruptionRegistry.ts`,
    find: 'reservation.status === "reserved" ||',
    replace: "true ||",
    project: "core",
    describes: "a participant that answers nothing taken as having reserved",
  },
  {
    file: `${core}/internal/disruptions/DisruptionRegistry.ts`,
    find: "return describeImpacts(context.impacts).disruptive;",
    replace: "return false;",
    project: "core",
    describes: "a guard that names no impacts never asked before a reload",
  },
  {
    file: `${core}/internal/disruptions/DisruptionRegistry.ts`,
    find: "if (participant.impacts?.length === 0) {",
    replace: "if (false) {",
    project: "core",
    describes: "a participant that lists no impacts registered anyway",
  },
  {
    file: `${core}/internal/disruptions/DisruptionRegistry.ts`,
    find: "reservation.resume?.();",
    replace: "",
    project: "core",
    describes: "a reservation that is never resumed",
  },
  {
    file: `${core}/internal/reads/SharedRead.ts`,
    find: "      reason: error.code,\n      cause,\n    });",
    replace: "      reason: error.code,\n    });",
    project: "core",
    describes:
      "a failed read leaving what its source threw off the diagnostic event",
  },
  {
    file: `${core}/internal/routes/FeedRoutes.ts`,
    find: "          reason: error.code,\n          cause,\n        });",
    replace: "          reason: error.code,\n        });",
    project: "core",
    describes:
      "a select function that throws leaving its error off the diagnostic event",
  },
  {
    file: `${core}/internal/routes/DriverRoutes.ts`,
    find: "this.#recordFailure(name, held);",
    replace: "this.#recordFailure(name);",
    project: "core",
    describes: "a held native module left unexplained by the event at start",
  },
  {
    file: `${core}/internal/routes/DriverRoutes.ts`,
    find: "      this.#recordFailure(name, cause);\n\n      return;\n    }\n\n    entry.session = opened;",
    replace:
      "      this.#recordFailure(name);\n\n      return;\n    }\n\n    entry.session = opened;",
    project: "core",
    describes:
      "a provider that threw when it opened leaving its error off the event at start",
  },
  {
    file: `${core}/internal/routes/DriverRoutes.ts`,
    find: "record.getNotOpen() ??\n        new BeaconError({",
    replace: "new BeaconError({",
    project: "core",
    describes: "a check of a route that failed to open not saying why",
  },
  {
    file: `${core}/internal/running/RunningRegistry.ts`,
    find: "cause: this.#thrown.get(next),",
    replace: "",
    project: "core",
    describes:
      "a failed running reader leaving its error off the diagnostic event",
  },
  {
    file: `${core}/internal/policy/PolicyRecord.ts`,
    find: "this.#options.onFailure(next.error, next.cause);",
    replace: "this.#options.onFailure(next.error);",
    project: "core",
    describes:
      "a support policy that throws leaving its error off the diagnostic event",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: 'record("journal-failed", { reason: "read", cause });',
    replace: 'record("journal-failed", { reason: "read" });',
    project: "core",
    describes:
      "a journal read that fails leaving its error off the diagnostic event",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: 'record("journal-failed", { reason: "clear", cause });',
    replace: 'record("journal-failed", { reason: "clear" });',
    project: "core",
    describes:
      "a journal removal that fails leaving its error off the diagnostic event",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: 'this.#config.record("journal-failed", { reason: "write", cause });',
    replace: 'this.#config.record("journal-failed", { reason: "write" });',
    project: "core",
    describes:
      "a journal write that fails leaving its error off the diagnostic event",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: 'record("journal-failed", { reason: "write", cause });\n      this.#publish({ journal: "degraded" });',
    replace:
      'record("journal-failed", { reason: "write" });\n      this.#publish({ journal: "degraded" });',
    project: "core",
    describes:
      "a journal reconciliation that fails to write leaving its error off the event",
  },
  {
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: "cause: this.#thrown.get(outcome),",
    replace: "",
    project: "core",
    describes: "a failed command leaving what was thrown off the settled event",
  },
  {
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: "this.#thrown.set(failed, written.value.error.cause);",
    replace: "",
    project: "core",
    describes:
      "a command stopped by its journal leaving the storage error off the settled event",
  },
  {
    file: `${core}/internal/diagnostics/Diagnostics.ts`,
    find: "cause: cause ?? null,",
    replace: "cause: null,",
    project: "core",
    describes: "an event that drops the cause it was given",
  },
  {
    file: `${core}/internal/feeds/FeedRecord.ts`,
    find: 'if (error.code !== "ABORTED") {',
    replace: "if (true) {",
    project: "core",
    describes:
      "a read nobody waited for taken for a failure of the policy source",
  },
  {
    file: `${core}/internal/feeds/FeedRecord.ts`,
    find: "this.#accepted = held;\n    this.#failure = null;",
    replace: "this.#accepted = held;",
    project: "core",
    describes: "a failed policy read remembered after a read is accepted",
  },
  {
    file: `${core}/internal/feeds/FeedRecord.ts`,
    find: "this.#accepted = null;\n    this.#failure = null;",
    replace: "this.#accepted = null;",
    project: "core",
    describes: "a failed policy read remembered across a scope replacement",
  },
  {
    file: `${core}/internal/policy/PolicyRecord.ts`,
    find: 'reason: "read-failed",\n      evaluation: null,',
    replace: 'reason: "not-checked",\n      evaluation: null,',
    project: "core",
    describes: "a policy whose first read failed reported as not checked",
  },
  {
    file: `${core}/internal/policy/PolicyRecord.ts`,
    find: "if (readFailure !== null) {",
    replace: "if (false) {",
    project: "core",
    describes:
      "a policy that lapsed after a failed read reported as only expired",
  },
  {
    file: `${core}/internal/selection/selectTarget.ts`,
    find: "running.identity.reason,\n    );",
    replace: "null,\n    );",
    project: "core",
    describes:
      "an unknown running identity left without the reason its reader gave",
  },
  {
    file: `${core}/internal/selection/selectTarget.ts`,
    find: "describeIdentityMismatch(running.identity, release.identity),",
    replace: "null,",
    project: "core",
    describes: "identities that cannot be compared left without what differs",
  },
  {
    file: `${core}/internal/selection/describeIdentityMismatch.ts`,
    find: "if (running.authority !== offered.authority) {",
    replace: "if (false) {",
    project: "core",
    describes: "an authority that differs left out of what is said to differ",
  },
  {
    file: `${core}/internal/selection/describeIdentityMismatch.ts`,
    find: "if (running.domain !== offered.domain) {",
    replace: "if (false) {",
    project: "core",
    describes: "a domain that differs left out of what is said to differ",
  },
  {
    file: `${core}/internal/routes/RouteRecord.ts`,
    find: "detail: selection.detail,\n        candidate: selection.candidate,\n      });\n\n      return;\n    }\n\n    assertUnreachable(selection);",
    replace:
      "detail: null,\n        candidate: selection.candidate,\n      });\n\n      return;\n    }\n\n    assertUnreachable(selection);",
    project: "core",
    describes: "an inconclusive observation that drops its detail",
  },
  {
    file: `${devtools}/components/Routes/ObservationSection.tsx`,
    find: '              <Field label="Reason">{observation.reason}</Field>\n              <Field label="Detail">\n                {formatOptionalText(observation.detail)}\n              </Field>\n              <Field label="Candidate">\n                {formatRelease(observation.candidate)}\n              </Field>\n            </Fields>\n            <EvidenceFields evidence={observation.evidence} />\n          </>\n        );\n      }\n\n      return assertUnreachable',
    replace:
      '              <Field label="Reason">{observation.reason}</Field>\n              <Field label="Candidate">\n                {formatRelease(observation.candidate)}\n              </Field>\n            </Fields>\n            <EvidenceFields evidence={observation.evidence} />\n          </>\n        );\n      }\n\n      return assertUnreachable',
    project: "devtools",
    describes: "an inconclusive observation shown without its detail",
  },
  {
    file: `${core}/internal/options/resolveJournalOptions.ts`,
    find: 'mode: options.mode ?? "best-effort",',
    replace: 'mode: options.mode ?? "required",',
    project: "core",
    describes: "a journal that names no mode made required",
  },
  {
    file: `${core}/internal/options/resolveJournalOptions.ts`,
    find: 'if ("getItem" in storage) {',
    replace: "if (false) {",
    project: "core",
    describes:
      "a key-value store handed to the journal used as a journal storage",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "this.#judgedHere.add(transition.intent);",
    replace: "",
    project: "core",
    describes: "an intent judged by this boot not remembered as judged here",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "judgedHere: this.#judgedHere.has(latest.intent),",
    replace: "judgedHere: true,",
    project: "core",
    describes: "an intent of another boot said to be judged by this one",
  },
  {
    file: `${core}/internal/journal/Journal.ts`,
    find: "judgedHere: this.#judgedHere.has(latest.intent),",
    replace: "judgedHere: false,",
    project: "core",
    describes: "an intent judged by this boot said to be judged by another",
  },
  {
    file: `${devtools}/components/Overview/TransitionsSection.tsx`,
    find: '{latest().judgedHere ? ", judged by this boot" : ""}',
    replace: '{""}',
    project: "devtools",
    describes: "an outcome shown without saying this boot judged it",
  },
  {
    file: `${core}/internal/commands/resolveCommand.ts`,
    find: "return given.ref;\n  }\n\n  return given;\n};\n\nconst readPreparedReference",
    replace:
      "return given;\n  }\n\n  return given;\n};\n\nconst readPreparedReference",
    project: "core",
    describes:
      "a command handed the offer itself that does not read the reference inside it",
  },
  {
    file: `${core}/internal/commands/resolveCommand.ts`,
    find: "return given.ref;\n  }\n\n  return given;\n};\n\nconst findOffer",
    replace: "return given;\n  }\n\n  return given;\n};\n\nconst findOffer",
    project: "core",
    describes:
      "a command handed the prepared target itself that does not read the reference inside it",
  },
  {
    file: `${devtools}/utils/copyEvent.ts`,
    find: "cause: describeCause(event.cause),",
    replace: "cause: null,",
    project: "devtools",
    describes: "an event copy that keeps no cause for the panel",
  },
  {
    file: `${devtools}/formatting/formatEventText.ts`,
    find: "return `${fields}\\n\\ncause\\n${event.cause}`;",
    replace: "return fields;",
    project: "devtools",
    describes: "an expanded row that does not show what a failure threw",
  },
  {
    file: `${devtools}/utils/inspectCause.ts`,
    find: 'description["message"] = readData(error, "message");',
    replace: "",
    project: "devtools",
    describes: "a thrown error shown without its message",
  },
  {
    file: `${devtools}/utils/inspectCause.ts`,
    find: "description[key] = readData(error, key);",
    replace: "",
    project: "devtools",
    describes: "a thrown error shown without its own fields",
  },
  {
    file: `${devtools}/utils/inspectCause.ts`,
    find: 'description["cause"] = describe(cause, depth + 1);',
    replace: "",
    project: "devtools",
    describes: "a thrown error shown without its cause",
  },
  {
    file: `${devtools}/utils/inspectCause.ts`,
    find: "if (!(value instanceof Error) || depth >= CHAIN) {",
    replace: "if (!(value instanceof Error)) {",
    project: "devtools",
    describes: "a chain of causes shown without an end",
  },
  {
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: "if (this.#options.disruptions.getRevision() !== lease.revision) {",
    replace: "if (false) {",
    project: "core",
    describes: "a dispatch after the participants changed what is safe",
  },
  {
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: '      this.#release(operation);\n\n      return this.#fail(cause, {\n        code: "COMMAND_FAILED",\n        message: "A command could not be carried out.",',
    replace:
      '      return this.#fail(cause, {\n        code: "COMMAND_FAILED",\n        message: "A command could not be carried out.",',
    project: "core",
    describes: "a call that fails leaving its route and reservations held",
  },
  {
    file: `${core}/internal/journal/createJournalKey.ts`,
    find: "return encodeLoneSurrogate(piece);",
    replace: "return encodeURIComponent(piece);",
    project: "core",
    describes: "a scope with text that is not well formed failing to start",
  },
  {
    file: "packages/react/src/hooks/useObservable.ts",
    find: "select(value.getInitial(), selector, isEqual)",
    replace: "select(value.get(), selector, isEqual)",
    project: "react",
    describes: "a server render that reads a session that has not started",
  },
  {
    file: "packages/react/src/context/BeaconProvider.tsx",
    find: ["import { useLayoutEffect }", "useLayoutEffect(() => {"],
    replace: ["import { useEffect }", "useEffect(() => {"],
    project: "react",
    describes: "a child's mount effect running before the session starts",
  },
  {
    file: "packages/solid/src/primitives/internal/useSelectedValue.ts",
    find: "resolve().getInitial()",
    replace: "resolve().get()",
    project: "solid-ssr",
    describes: "a server render that reads a session that has not started",
  },
  {
    file: "packages/vue/src/composables/internal/useSelectedValue.ts",
    find: "resolve().getInitial()",
    replace: "resolve().get()",
    project: "vue-ssr",
    describes: "a server render that reads a session that has not started",
  },
  {
    file: "packages/svelte/src/utilities/internal/useSelectedValue.svelte.ts",
    find: ".getInitial()",
    replace: ".get()",
    project: "svelte-ssr",
    describes: "a server render that reads a session that has not started",
  },
  {
    file: "packages/solid/src/context/BeaconProvider.ts",
    find: "onCleanup(untrack(() => beacon.start()));",
    replace: "onCleanup(beacon.start());",
    project: "solid",
    describes: "what a listener reads while the session starts restarting it",
  },
  {
    file: "packages/svelte/src/context/BeaconProvider.svelte",
    find: "return untrack(() => beacon.start());",
    replace: "return beacon.start();",
    project: "svelte",
    describes: "what a listener reads while the session starts restarting it",
  },
  {
    file: "packages/react/src/utils/createSelectionCache.ts",
    find: "if (last !== null && isEqual(last.selected, selected)) {",
    replace: "if (false) {",
    project: "react",
    describes: "an equal selection losing its reference across renders",
  },
  {
    file: "packages/react/src/utils/createSelectionCache.ts",
    find: " &&\n      last.selector === selector",
    replace: "",
    project: "react",
    describes: "a new selector answered with the last selection",
  },
  {
    file: "packages/vue/src/composables/useDisruption.ts",
    find: '{ immediate: true, flush: "sync" }',
    replace: "{ immediate: true }",
    project: "vue",
    describes: "a command right after a new Beacon missing its participant",
  },
  {
    file: `${http}/http.ts`,
    find: "memory?.scope === scope ? memory : null",
    replace: "memory",
    project: "http",
    describes: "an answer renewed for another account",
  },
  {
    file: `${http}/http.ts`,
    find: "if (held === null) {",
    replace: "if (false) {",
    project: "http",
    describes: "a not modified answer that invents the document it renews",
  },
  {
    file: `${http}/http.ts`,
    find: 'if (answer.status !== "not-modified") {',
    replace: "if (false) {",
    project: "http",
    describes: "an answer nobody recognizes renewing what is held",
  },
  {
    file: `${http}/parseStandardManifest.ts`,
    find: 'if (readField(record, "schemaVersion") !== SCHEMA_VERSION) {',
    replace: "if (false) {",
    project: "http",
    describes: "an unknown schema version read",
  },
  {
    file: `${http}/utils/assertScope.ts`,
    find: "return echoed !== undefined && readText(echoed, key) !== scope[key];",
    replace: "return false;",
    project: "http",
    describes: "a manifest for another scope accepted",
  },
  {
    file: `${http}/utils/readRoutes.ts`,
    find: "if (decision === undefined) {",
    replace: "if (false) {",
    project: "http",
    describes: "a missing route read as a decision",
  },
  {
    file: `${http}/utils/readExpiry.ts`,
    find: "if (expiresAt <= now) {",
    replace: "if (false) {",
    project: "http",
    describes: "a stale copy accepted as fresh",
  },
  {
    file: `${http}/utils/readExpiry.ts`,
    find: "return { expiresAt: Math.min(expiresAt, now + limits.lifetime) };",
    replace: "return { expiresAt };",
    project: "http",
    describes: "an expiry longer than the local limit",
  },
  {
    file: `${http}/utils/readExpiry.ts`,
    find: "return { expiresAt: now + limits.lifetime, holdsFor: limits.lifetime };",
    replace:
      "return { expiresAt: now + limits.lifetime * 2, holdsFor: limits.lifetime };",
    project: "http",
    describes:
      "a manifest with no expiry of its own holding for longer than the client's window",
  },
  {
    file: `${http}/utils/readExpiry.ts`,
    find: "if (issuedAt !== null && issuedAt - now > limits.skew) {",
    replace: "if (false) {",
    project: "http",
    describes: "a manifest issued ahead of the local clock accepted",
  },
  {
    file: `${http}/http.ts`,
    find: "held.holdsFor === null ? undefined : clock.now() + held.holdsFor;",
    replace: "undefined;",
    project: "http",
    describes:
      "a confirmation of an answer with no expiry of its own that never starts its window again",
  },
  {
    file: `${http}/http.ts`,
    find: 'if (answer.status === undefined || answer.status === "changed") {',
    replace: 'if (answer.status === "changed") {',
    project: "http",
    describes: "an answer that returns only a document taken for garbage",
  },
  {
    file: `${http}/utils/createIdentityShorthand.ts`,
    find: 'if (declaration.kind === "target") {',
    replace: "if (true) {",
    project: "http",
    describes: "a text identity of a binary named as a web artifact",
  },
  {
    file: `${http}/utils/readShortIdentity.ts`,
    find: 'return { status: "known", authority, domain, value: readText(value, field) };',
    replace:
      'return { status: "known", authority: domain, domain, value: readText(value, field) };',
    project: "http",
    describes:
      "a text identity named under another authority than the application's",
  },
  {
    file: `${http}/standardManifestSource.ts`,
    find: 'cache: "no-cache",',
    replace: 'cache: "default",',
    project: "http",
    describes:
      "a manifest served from a browser's stored copy without asking the server",
  },
  {
    file: `${http}/standardManifestSource.ts`,
    find: '{ ...headers, "if-none-match": validator }',
    replace: "{ ...headers }",
    project: "http",
    describes: "a manifest source that never sends back the validator it holds",
  },
  {
    file: `${http}/standardManifestSource.ts`,
    find: "now: clock.now(),",
    replace: "now: 0,",
    project: "http",
    describes: "a manifest dated by a clock other than the Beacon's",
  },
  {
    file: `${http}/standardManifestSource.ts`,
    find: 'if (typeof fetch === "undefined") {',
    replace: "if (false) {",
    project: "http",
    describes:
      "a host without fetch failing the read with a missing name instead of the option to pass",
  },
  {
    file: `${http}/utils/readTimestamp.ts`,
    find: "if (milliseconds === undefined) {",
    replace: "if (false) {",
    project: "http",
    describes: "a manifest time the core cannot read passed on as one",
  },
  {
    file: `${http}/utils/readRelease.ts`,
    find: "if (UNSAFE_KEYS.includes(key)) {",
    replace: "if (false) {",
    project: "http",
    describes: "a key that corrupts a registry accepted",
  },
  {
    file: `${http}/utils/readDecision.ts`,
    find: 'if (declaration.kind !== "target") {',
    replace: "if (false) {",
    project: "http",
    describes: "a candidate read on a target route",
  },
  {
    file: `${http}/readStandardManifest.ts`,
    find: "if (response.redirected === true) {",
    replace: "if (false) {",
    project: "http",
    describes: "a redirected manifest trusted",
  },
  {
    file: `${http}/readStandardManifest.ts`,
    find: 'if (!isJson(response.headers.get("content-type"))) {',
    replace: "if (false) {",
    project: "http",
    describes: "a login page read as a manifest",
  },
  {
    file: `${http}/readStandardManifest.ts`,
    find: 'if (Number(response.headers.get("content-length")) > bounds.bytes) {',
    replace: "if (false) {",
    project: "http",
    describes: "an oversized body read",
  },
  {
    file: `${devtools}/utils/inspectValue.ts`,
    find: "if (SECRET_KEY.test(key)) {",
    replace: "if (false) {",
    project: "devtools",
    describes: "a property named like a secret shown with the raw values",
  },
  {
    file: `${devtools}/utils/EventLog.ts`,
    find: "this.#events = [entry, ...this.#events].slice(0, this.#limit);",
    replace: "this.#events = [entry, ...this.#events];",
    project: "devtools",
    describes: "a history that grows past the events it was told to keep",
  },
  {
    file: `${devtools}/components/Routes/NativeSection.tsx`,
    find: "when={props.showRaw}",
    replace: "when={true}",
    project: "devtools",
    describes: "a provider's handle shown while raw values are off",
  },
  {
    file: "packages/adapters/app-store/src/appStoreLookup.ts",
    find: "if (scope.distribution !== APP_STORE_DISTRIBUTION) {",
    replace: "if (false) {",
    project: "app-store",
    describes: "a TestFlight build offered an App Store route",
  },
  {
    file: "packages/adapters/app-store/src/utils/readLookupDocument.ts",
    find: "if (releasedAt === undefined) {",
    replace: "if (false) {",
    project: "app-store",
    describes: "a release date the core cannot read passed on as one",
  },
  {
    file: "packages/adapters/service-worker/src/utils/readWorkers.ts",
    find: "      metadata: { worker: { id } },\n",
    replace: "",
    project: "service-worker",
    describes: "two waiting workers of one build offered as the same release",
  },
  {
    file: "packages/adapters/google-play/src/googlePlay.ts",
    find: "if (signal.aborted) {",
    replace: "if (false) {",
    project: "google-play",
    describes: "a flow started for a caller that stopped waiting",
  },
  {
    file: "packages/adapters/google-play/src/utils/PlaySession.ts",
    find: "if (signal.aborted) {",
    replace: "if (false) {",
    project: "google-play",
    describes: "a flow started for a session that ended",
  },
  {
    file: "packages/adapters/expo/src/utils/createUpdateIdentity.ts",
    find: ".toLowerCase()",
    replace: "",
    project: "expo",
    describes: "an update id in capitals compared unequal to the one running",
  },
  {
    file: "packages/adapters/google-play/src/googlePlay.ts",
    find: "exclusive: bridge,",
    replace: "",
    project: "google-play",
    describes: "two Beacons sharing one Play bridge",
  },
  {
    file: "packages/adapters/expo/src/expoUpdates.ts",
    find: "exclusive: updates,",
    replace: "",
    project: "expo",
    describes: "two Beacons sharing one Expo module",
  },
  {
    file: "packages/adapters/firebase-remote-config/src/utils/createParameters.ts",
    find: "if (source(key) !== REMOTE) {",
    replace: "if (false) {",
    project: "firebase-remote-config",
    describes:
      "a default of the application, or a key nothing defines, read as the server's answer",
  },
  {
    file: "packages/adapters/firebase-remote-config/src/firebaseRemoteConfig.ts",
    find: "if (!(fetchTimeMillis > 0)) {",
    replace: "if (false) {",
    project: "firebase-remote-config",
    describes:
      "a configuration that never fetched answering with the application's own defaults",
  },
  {
    file: "packages/adapters/firebase-remote-config/src/firebaseRemoteConfig.ts",
    find: "await sdk.ensureInitialized(remoteConfig);",
    replace: "",
    project: "firebase-remote-config",
    describes:
      "a read before the SDK loaded the values it activated in an earlier run",
  },
  {
    file: "packages/adapters/firebase-remote-config/src/firebaseRemoteConfig.ts",
    find: 'if (onFetchFailure !== "use-activated") {\n          throw cause;\n        }',
    replace: "",
    project: "firebase-remote-config",
    describes: "a failed fetch answered from old values without being asked to",
  },
  {
    file: "packages/adapters/firebase-remote-config/src/firebaseRemoteConfig.ts",
    find: "fetchTimeMillis + (maxAge ?? settings.minimumFetchIntervalMillis)",
    replace: "maxAge ?? settings.minimumFetchIntervalMillis",
    project: "firebase-remote-config",
    describes:
      "an answer whose expiry is not counted from the fetch that got it",
  },
  {
    file: "packages/adapters/code-push/src/codePushUpdates.ts",
    find: "exclusive: codePush,",
    replace: "",
    project: "code-push",
    describes: "two Beacons sharing one CodePush module",
  },
  {
    file: "packages/adapters/code-push/src/utils/CodePushSession.ts",
    find: 'if (\n      staged === null ||\n      compareIdentities(staged.release.identity, identity) !== "same"\n    ) {',
    replace: "if (false) {",
    project: "code-push",
    describes:
      "a package called staged before CodePush listed it as pending, and a prepared target nobody confirmed",
  },
  {
    file: "packages/adapters/code-push/src/utils/CodePushSession.ts",
    find: "await local.install(codePush.InstallMode.ON_NEXT_RESTART);",
    replace: "await local.install(0);",
    project: "code-push",
    describes:
      "an update installed with a mode nobody chose, which can restart the app at once",
  },
  {
    file: "packages/adapters/code-push/src/utils/CodePushSession.ts",
    find: "const local = await offered.remote.download(this.#reportProgress);\n\n    if (signal.aborted) {",
    replace:
      "const local = await offered.remote.download(this.#reportProgress);\n\n    if (false) {",
    project: "code-push",
    describes: "a package installed for a caller that stopped waiting",
  },
  {
    file: "packages/adapters/code-push/src/utils/CodePushSession.ts",
    find: "if (this.#offered === offered) {",
    replace: "if (false) {",
    project: "code-push",
    describes:
      "a package downloaded again after it was installed, which deletes the folder CodePush runs from",
  },
  {
    file: `${core}/internal/policy/PolicyRecord.ts`,
    find: "this.#options.runsWithoutOffer(route)",
    replace: "false",
    project: "core",
    describes:
      "a store route read as not usable for a forced upgrade, because it has no offer to download",
  },
  {
    file: `${core}/internal/routes/RouteRegistry.ts`,
    find: 'reference === "optional-offer"',
    replace: 'reference === "none"',
    project: "core",
    describes:
      "a route whose command needs an offer read as one that can act without",
  },
  {
    file: `${core}/internal/routes/RouteRegistry.ts`,
    find: "entry.record.native.get() === null",
    replace: "false",
    project: "core",
    describes:
      "a store route that never opened read as usable for a forced upgrade",
  },
  {
    file: `${core}/internal/running/describeMissingRunning.ts`,
    find: 'if (state === "failed") {',
    replace: "if (false) {",
    project: "core",
    describes:
      "an inconclusive observation that cannot tell a reader that failed from one that has not answered",
  },
  {
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: "entry.record.getNotOpen() ??",
    replace: "null ??",
    project: "core",
    describes:
      "a command that finds its provider closed saying only that it is not open, with the reason a check gives lost",
  },
  {
    file: "packages/adapters/expo/src/utils/readNativeRelease.ts",
    find: "facts.applicationId !== (options.authority ?? scope.application)",
    replace: "false",
    project: "expo",
    describes:
      "Expo Go's build number named under this application's authority",
  },
  {
    file: "packages/adapters/expo/src/utils/readNativeRelease.ts",
    find: "facts.applicationId !== (options.authority ?? scope.application)",
    replace:
      "facts.applicationId !== (options.authority ?? facts.applicationId)",
    project: "expo",
    describes:
      "the authority of a binary taken from the binary itself, where the scope names the application",
  },
  {
    file: "packages/adapters/expo/src/utils/readNativeRelease.ts",
    find: "if (platform === null) {",
    replace: "if (false) {",
    project: "expo",
    describes:
      "a build number of the web or a desktop shell named as an Android build",
  },
  {
    file: "packages/adapters/expo/src/utils/readNativeRelease.ts",
    find: "options.platform ?? readPlatform(scope.platform)",
    replace: 'options.platform ?? "android"',
    project: "expo",
    describes:
      "an iOS build named by its version code, whatever the scope says",
  },
  {
    file: "packages/adapters/expo/src/utils/constants/authority.ts",
    find: "android: ANDROID_VERSION_CODE_DOMAIN,",
    replace: 'android: "native-android-build",',
    project: "expo",
    describes:
      "an Android build named in other words than the Play route offers in",
  },
  {
    file: "packages/adapters/device-info/src/utils/readNativeRelease.ts",
    find: "facts.applicationId !== (options.authority ?? scope.application)",
    replace: "false",
    project: "device-info",
    describes:
      "Expo Go's build number named under this application's authority",
  },
  {
    file: "packages/adapters/device-info/src/utils/readNativeRelease.ts",
    find: "if (platform === null) {",
    replace: "if (false) {",
    project: "device-info",
    describes:
      "a build number of the web or a desktop shell named as an Android build",
  },
  {
    file: "packages/adapters/device-info/src/utils/readNativeRelease.ts",
    find: "options.platform ?? readPlatform(scope.platform)",
    replace: 'options.platform ?? "android"',
    project: "device-info",
    describes:
      "an iOS build named by its version code, whatever the scope says",
  },
  {
    file: "packages/adapters/device-info/src/utils/readDeviceInfoText.ts",
    find: "if (text === DEVICE_INFO_NOT_READ) {",
    replace: "if (false) {",
    project: "device-info",
    describes:
      "the text unknown from react-native-device-info taken for a build",
  },
  {
    file: "packages/adapters/device-info/src/utils/constants/authority.ts",
    find: "android: ANDROID_VERSION_CODE_DOMAIN,",
    replace: 'android: "native-android-build",',
    project: "device-info",
    describes:
      "an Android build named in other words than the Play route offers in",
  },
  {
    file: "packages/adapters/expo/src/expoUpdates.ts",
    find: "running: expoBundle({ updates }),",
    replace: "",
    project: "expo",
    describes:
      "a route that leaves the journal with no bundle to read a reload back against",
  },
  {
    file: "packages/adapters/code-push/src/codePushUpdates.ts",
    find: "running: codePushBundle({ codePush }),",
    replace: "",
    project: "code-push",
    describes:
      "a route that leaves the journal with no bundle to read a reload back against",
  },
  {
    file: "packages/adapters/browser/src/webBuild.ts",
    find: "authority: authority ?? scope.application,",
    replace: 'authority: authority ?? "",',
    project: "browser",
    describes:
      "a web build named under no application, so it is never the one a manifest names",
  },
  {
    file: "packages/adapters/browser/src/utils/readBuildText.ts",
    find: 'text === "" || NOT_INJECTED_TEXTS.has(text)',
    replace: 'text === ""',
    project: "browser",
    describes: "a define written into text taken for a build named undefined",
  },
  {
    file: "packages/adapters/browser/src/browserStorage.ts",
    find: 'area = "session",',
    replace: 'area = "local",',
    project: "browser",
    describes:
      "a journal shared by every tab where two tabs overwrite each other",
  },
  {
    file: "packages/adapters/browser/src/utils/openStorage.ts",
    find: "      { cause },\n",
    replace: "",
    project: "browser",
    describes: "a blocked storage rejecting without the browser's own error",
  },
  {
    file: "packages/adapters/browser/src/webRelease.ts",
    find: "if (value === null) {",
    replace: "if (false) {",
    project: "browser",
    describes: "a release named after a define nobody set",
  },
  {
    file: "packages/adapters/browser/src/webRelease.ts",
    find: "domain: WEB_ARTIFACT_DOMAIN,",
    replace: 'domain: "web",',
    project: "browser",
    describes:
      "a release named in other words than the reader of the running build uses",
  },
  {
    file: "packages/adapters/browser/src/webRelease.ts",
    find: 'assertIdentityText("authority", authority);',
    replace: "",
    project: "browser",
    describes: "a release under an authority with a space around it",
  },
  {
    file: `${triggers}/utils/openGate.ts`,
    find: "startup = true,",
    replace: "startup = false,",
    project: "core",
    describes: "a session that opens and checks nothing until a trigger fires",
  },
  {
    file: `${triggers}/browser/foreground.ts`,
    find: "if (!event.persisted) {",
    replace: "if (false) {",
    project: "core",
    describes: "a fresh page load taken for a page restored from the cache",
  },
  {
    file: `${triggers}/browser/foreground.ts`,
    find: "      if (!away) {\n        return;\n      }\n",
    replace: "",
    project: "core",
    describes: "a tab shown again that was never hidden checking as a return",
  },
  {
    file: `${triggers}/browser/utils/getGlobalWindow.ts`,
    find: 'typeof window === "undefined" || typeof window.document !== "object"',
    replace: 'typeof window === "undefined"',
    project: "core",
    describes: "the global object of React Native taken for a browser's window",
  },
  {
    file: `${triggers}/utils/openGate.ts`,
    find: 'const mode = reason === "reconnect" ? "after-current" : "join";',
    replace: 'const mode = "join";',
    project: "core",
    describes: "a reconnect joining the read that met the dead network",
  },
  {
    file: `${triggers}/reconnect.ts`,
    find: "if (before !== false || isConnected !== true) {",
    replace: "if (isConnected !== true) {",
    project: "core",
    describes:
      "the state NetInfo reports as soon as it is subscribed to taken for a reconnect",
  },
  {
    file: `${triggers}/foreground.ts`,
    find: 'if (state !== "active" || !away) {',
    replace: 'if (state !== "active") {',
    project: "core",
    describes: "an iOS system dialog taken for a return from the background",
  },
  {
    file: `${triggers}/utils/openGate.ts`,
    find: "    inFlight -= 1;\n\n    if (closed) {\n      return;\n    }\n",
    replace: "    inFlight -= 1;\n",
    project: "core",
    describes: "a check that fails after the stop arming a wait and a retry",
  },
  {
    file: `${triggers}/utils/signalReturn.ts`,
    find: "observedAway !== null && observedAway < minAway",
    replace: "observedAway < minAway",
    project: "core",
    describes: "a return whose absence nobody measured skipped as short",
  },
  {
    file: `${core}/internal/feeds/FeedRecord.ts`,
    find: "source.read({ scope: getScope(), signal, attempt, clock }),",
    replace:
      "source.read({ scope: getScope(), signal, attempt, clock: { ...clock, now: () => 0 } }),",
    project: "core",
    describes:
      "a source read handed a clock other than the one the Beacon runs on",
  },
  {
    file: `${triggers}/utils/constants/defaults.ts`,
    find: '"foreground",\n  "interval",\n]);',
    replace: '"foreground",\n  "interval",\n  "retry",\n]);',
    project: "core",
    describes:
      "a retry after a failed check dropped because the evidence it failed to renew is still fresh",
  },
  {
    file: `${triggers}/utils/openGate.ts`,
    find: 'signal("expiry")',
    replace: 'signal("interval")',
    project: "core",
    describes: "an expiry recheck labelled as the timer's",
  },
  // What Hermes lacks or reads differently: the projects that run a package in
  // the environment of a React Native app must notice where the plain ones do not.
  {
    file: `${core}/internal/clock/createSystemClock.ts`,
    find: "now: () => Date.now(),",
    replace: "now: () => (crypto.randomUUID().length > 0 ? Date.now() : 0),",
    project: "core-hermes",
    describes: "a clock that needs Web Crypto, which Hermes does not have",
  },
  {
    file: `${core}/parseUtcTimestamp.ts`,
    find: "const SECONDS_LENGTH = 19;",
    replace: "const SECONDS_LENGTH = 10;",
    project: "core-hermes",
    describes:
      "a UTC timestamp whose time of day Hermes rolled over, such as minute 60, taken for one that exists",
  },
  {
    file: `${http}/utils/readTimestamp.ts`,
    find: "parseUtcTimestamp(value)",
    replace: "Date.parse(value)",
    project: "http-hermes",
    describes:
      "a manifest time read by the engine's own parser, which Hermes rolls over at minute 60",
  },
  {
    file: "packages/adapters/app-store/src/utils/readLookupDocument.ts",
    find: "parseUtcTimestamp(entry.currentVersionReleaseDate)",
    replace: "Date.parse(entry.currentVersionReleaseDate)",
    project: "app-store-hermes",
    describes:
      "a release date read by the engine's own parser, which Hermes rolls over at minute 60",
  },
  {
    file: "packages/react/src/context/BeaconProvider.tsx",
    find: "    if (!start) {",
    replace: "    document.title;\n\n    if (!start) {",
    project: "react-native",
    describes: "a provider that reads the document, which React Native lacks",
  },
  {
    file: "packages/react/src/context/BeaconProvider.tsx",
    find: "  start = true,",
    replace: "  start = false,",
    project: "react",
    describes:
      "a provider that leaves the session to the application unless asked",
  },
  {
    file: "packages/react/src/context/BeaconProvider.tsx",
    find: "  start = true,",
    replace: "  start = false,",
    project: "react-native",
    describes:
      "a provider without a DOM that leaves the session to the application unless asked",
  },
  {
    file: "packages/vue/src/context/BeaconProvider.ts",
    find: "start: { type: Boolean, default: true },",
    replace: "start: { type: Boolean, default: false },",
    project: "vue",
    describes:
      "a provider that leaves the session to the application unless asked",
  },
  {
    file: "packages/solid/src/context/BeaconProvider.ts",
    find: "if (props.start === false) {",
    replace: "if (!props.start) {",
    project: "solid",
    describes:
      "a provider that leaves the session to the application unless asked",
  },
  {
    file: "packages/svelte/src/context/BeaconProvider.svelte",
    find: "const { beacon, start = true } = props;",
    replace: "const { beacon, start = false } = props;",
    project: "svelte",
    describes:
      "a provider that leaves the session to the application unless asked",
  },
  {
    file: "packages/react/src/hooks/internal/useProvidedBeacon.ts",
    find: "message: `${hook} needs",
    replace: "message: `useBeacon needs",
    project: "react",
    describes: "a hook outside a provider naming another hook",
  },
  {
    file: "packages/react/src/hooks/internal/useProvidedBeacon.ts",
    find: " (from @priemskiyyy/beacon-react)",
    replace: "",
    project: "react",
    describes: "a hook outside a provider not naming the package that has it",
  },
  {
    file: "packages/vue/src/composables/internal/useProvidedBeacon.ts",
    find: "message: `${composable} needs",
    replace: "message: `useBeacon needs",
    project: "vue",
    describes: "a composable outside a provider naming another composable",
  },
  {
    file: "packages/vue/src/composables/internal/useProvidedBeacon.ts",
    find: " (from @priemskiyyy/beacon-vue)",
    replace: "",
    project: "vue",
    describes:
      "a composable outside a provider not naming the package that has it",
  },
  {
    file: "packages/solid/src/primitives/internal/useProvidedBeacon.ts",
    find: "message: `${primitive} needs",
    replace: "message: `useBeacon needs",
    project: "solid",
    describes: "a primitive outside a provider naming another primitive",
  },
  {
    file: "packages/solid/src/primitives/internal/useProvidedBeacon.ts",
    find: " (from @priemskiyyy/beacon-solid)",
    replace: "",
    project: "solid",
    describes:
      "a primitive outside a provider not naming the package that has it",
  },
  {
    file: "packages/svelte/src/utilities/internal/useProvidedBeacon.ts",
    find: "message: `${utility} needs",
    replace: "message: `useBeacon needs",
    project: "svelte",
    describes: "a utility outside a provider naming another utility",
  },
  {
    file: "packages/svelte/src/utilities/internal/useProvidedBeacon.ts",
    find: " (from @priemskiyyy/beacon-svelte)",
    replace: "",
    project: "svelte",
    describes:
      "a utility outside a provider not naming the package that has it",
  },
  {
    file: `${core}/internal/errors/createUnknownRouteError.ts`,
    find: 'message: `The route "${name}" is not defined. ${listRoutes(known)}`,',
    replace: 'message: `The route "${name}" is not defined.`,',
    project: "core",
    describes: "an unknown route name that does not list the routes there are",
  },
  {
    file: `${core}/internal/routes/FeedRoutes.ts`,
    find: "opened = definition.mechanism.open({ scope: this.#options.getScope() });",
    replace:
      'opened = definition.mechanism.open({ scope: { ...this.#options.getScope(), environment: "" } });',
    project: "core",
    describes: "a mechanism opened with a scope other than its session's",
  },
  {
    file: `${expo}/applyUpdate.ts`,
    find: 'if (download.status !== "accepted") {',
    replace: 'if (download.status === "failed") {',
    project: "expo",
    describes:
      "an update reloaded after a download that was blocked or refused",
  },
  {
    file: `${expo}/applyUpdate.ts`,
    find: 'if (reloaded.step === "none") {',
    replace: "if (false) {",
    project: "expo",
    describes: "an accepted download that prepared nothing answered as no step",
  },
  {
    file: `${expo}/applyUpdate.ts`,
    find: "return reloadPrepared(route, null);",
    replace: 'return { step: "none" };',
    project: "expo",
    describes:
      "an update downloaded earlier left unreloaded when nothing is on offer",
  },
  {
    file: `${expo}/utils/reloadPrepared.ts`,
    find: 'if (prepared.status !== "ready") {',
    replace: "if (false) {",
    project: "expo",
    describes: "a reload asked for a target nothing prepared",
  },
  {
    file: `${expo}/mock/createFakeUpdates.ts`,
    find: "isEnabled: !disabled,",
    replace: "isEnabled: true,",
    project: "expo",
    describes: "a fake whose updates are never off",
  },
  {
    file: `${expo}/mock/createFakeUpdates.ts`,
    find: "calls.fetches += 1;",
    replace: "",
    project: "expo",
    describes: "a fake that does not count what the route fetched",
  },
  {
    file: `${appStore}/appStoreHandoff.ts`,
    find: "if (native.distribution !== APP_STORE_DISTRIBUTION) {",
    replace: "if (false) {",
    project: "app-store",
    describes: "the App Store opened for a build that is not the store's",
  },
  {
    file: `${appStore}/utils/fetchLookup.ts`,
    find: "if (!response.ok) {",
    replace: "if (false) {",
    project: "app-store",
    describes: "a failing status of the lookup read as an answer",
  },
  {
    file: `${appStore}/utils/fetchLookup.ts`,
    find: "if (response.redirected === true) {",
    replace: "if (false) {",
    project: "app-store",
    describes: "a redirected lookup read as an answer",
  },
  {
    file: `${appStore}/utils/readLookupResponse.ts`,
    find: 'typeof trackId !== "number" ||\n    typeof bundleId',
    replace: "typeof bundleId",
    project: "app-store",
    describes: "an entry of another type let through the default lookup client",
  },
  {
    file: `${appStore}/appStore.ts`,
    find: "fetch: lookUp = fetchLookup,",
    replace: "fetch: lookUp = async () => ({ results: [] }),",
    project: "app-store",
    describes: "a route with no client of its own that asks nobody",
  },
  {
    file: `${googlePlay}/playStore.ts`,
    find: "if (native.distribution !== GOOGLE_PLAY_DISTRIBUTION) {",
    replace: "if (false) {",
    project: "google-play",
    describes: "the Play Store opened for a build that is not Play's",
  },
  {
    file: `${googlePlay}/playStore.ts`,
    find: "await native.linking.openURL(web);",
    replace: 'return { status: "unsupported", reason: "no-store" };',
    project: "google-play",
    describes: "a device with no Play Store app left without the web page",
  },
  {
    file: `${googlePlay}/utils/assertApplicationId.ts`,
    find: "+$/.test(applicationId)",
    replace: "*$/.test(applicationId)",
    project: "google-play",
    describes: "an application id of one name let into a store link",
  },
];

const run = (project) => {
  try {
    execFileSync("npx", ["vitest", "run", "--project", project], {
      cwd: root,
      stdio: "ignore",
    });

    return true;
  } catch {
    return false;
  }
};

const readProjects = (args) => {
  const names = [];

  for (let index = 0; index < args.length; index += 2) {
    const name = args[index + 1];

    if (args[index] !== "--project" || name === undefined) {
      throw new Error(
        `Unknown argument ${args[index]}. Usage: node scripts/mutate.mjs [--project <name>]...`,
      );
    }

    names.push(name);
  }

  return names;
};

const root = process.cwd();

const known = new Set(MUTANTS.map((mutant) => mutant.project));
const chosen = readProjects(process.argv.slice(2));

for (const name of chosen) {
  if (!known.has(name)) {
    throw new Error(
      `No mutant runs in the project ${name}. Projects with mutants: ${[...known].join(", ")}.`,
    );
  }
}

const selected = MUTANTS.filter(
  (mutant) => chosen.length === 0 || chosen.includes(mutant.project),
);

// Every mutant is held to this, the ones a filter leaves out too, so that a file that moved is found by whoever runs any of them.
for (const mutant of MUTANTS) {
  const original = readFileSync(mutant.file, "utf8");

  for (const find of [mutant.find].flat()) {
    if (original.split(find).length !== 2) {
      throw new Error(`${mutant.file} must contain exactly once: ${find}`);
    }
  }
}

for (const project of new Set(selected.map((mutant) => mutant.project))) {
  if (!run(project)) {
    throw new Error(`The baseline of ${project} is red: fix it first.`);
  }
}

const survivors = [];

for (const mutant of selected) {
  const original = readFileSync(mutant.file, "utf8");
  const finds = [mutant.find].flat();
  const replaces = [mutant.replace].flat();

  // A mutant may change several places at once, such as an import and its use.
  const mutated = finds.reduce(
    (source, find, index) => source.replace(find, replaces[index] ?? ""),
    original,
  );

  writeFileSync(mutant.file, mutated);

  let survived = false;

  try {
    survived = run(mutant.project);
  } finally {
    writeFileSync(mutant.file, original);
  }

  if (survived) {
    survivors.push(mutant);
  }

  console.log(`${survived ? "SURVIVED" : "killed  "} ${mutant.describes}`);
}

if (survivors.length > 0) {
  process.exit(1);
}

console.log(`Killed all ${selected.length} mutants.`);
