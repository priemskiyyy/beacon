// Mutation checks: each mutant weakens one rule the tests must defend. A
// survivor is either a missing test or dead code. Every changed file is
// restored, and a red baseline stops the run.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const core = "packages/core/src/utils";
const mock = "packages/core/src/mock";
const testing = "packages/core/src/testing";
const http = "packages/adapters/http/src";
const devtools = "packages/devtools/src";

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
    find: "this.#fail(flight, toBeaconError(cause, errors.failed));\n\n      return;",
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
    find: "    this.#accepted = null;\n  };",
    replace: "  };",
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
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: "if (this.#options.disruptions.getRevision() !== lease.revision) {",
    replace: "if (false) {",
    project: "core",
    describes: "a dispatch after the participants changed what is safe",
  },
  {
    file: `${core}/internal/commands/CommandCoordinator.ts`,
    find: '      this.#release(operation);\n\n      return {\n        status: "failed",',
    replace: '      return {\n        status: "failed",',
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
    find: "(key) => readText(readField(record, key), key) !== scope[key],",
    replace: "() => false,",
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
    find: "return Math.min(expiresAt, now + limits.lifetime);",
    replace: "return expiresAt;",
    project: "http",
    describes: "an expiry longer than the local limit",
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
    file: "packages/adapters/native/src/utils/readNativeRelease.ts",
    find: "facts.applicationId !== options.authority",
    replace: "false",
    project: "native",
    describes:
      "Expo Go's build number named under this application's authority",
  },
  {
    file: "packages/adapters/native/src/utils/readDeviceInfoText.ts",
    find: "if (text === DEVICE_INFO_NOT_READ) {",
    replace: "if (false) {",
    project: "native",
    describes:
      "the text unknown from react-native-device-info taken for a build",
  },
  {
    file: "packages/adapters/native/src/utils/constants/authority.ts",
    find: 'export const ANDROID_DOMAIN = "android-version-code";',
    replace: 'export const ANDROID_DOMAIN = "native-android-build";',
    project: "native",
    describes:
      "an Android build named in other words than the Play route offers in",
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

const root = process.cwd();

for (const project of new Set(MUTANTS.map((mutant) => mutant.project))) {
  if (!run(project)) {
    throw new Error(`The baseline of ${project} is red: fix it first.`);
  }
}

const survivors = [];

for (const mutant of MUTANTS) {
  const original = readFileSync(mutant.file, "utf8");
  const finds = [mutant.find].flat();
  const replaces = [mutant.replace].flat();

  for (const find of finds) {
    if (original.split(find).length !== 2) {
      throw new Error(`${mutant.file} must contain exactly once: ${find}`);
    }
  }

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

console.log(`Killed all ${MUTANTS.length} mutants.`);
