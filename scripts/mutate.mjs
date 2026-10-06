// Mutation checks: each mutant weakens one rule the tests must defend. A
// survivor is either a missing test or dead code. Every changed file is
// restored, and a red baseline stops the run.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const core = "packages/core/src/utils";
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
    file: `${http}/utils/parseStandardManifest.ts`,
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
    find: "new Date(milliseconds).toISOString().slice(0, SECONDS_LENGTH) !==\n      value.slice(0, SECONDS_LENGTH)",
    replace: "false",
    project: "http",
    describes: "a date that does not exist rolled over",
  },
  {
    file: `${http}/utils/readMetadata.ts`,
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
    file: `${http}/utils/readStandardManifest.ts`,
    find: "if (response.redirected === true) {",
    replace: "if (false) {",
    project: "http",
    describes: "a redirected manifest trusted",
  },
  {
    file: `${http}/utils/readStandardManifest.ts`,
    find: 'if (!isJson(response.headers.get("content-type"))) {',
    replace: "if (false) {",
    project: "http",
    describes: "a login page read as a manifest",
  },
  {
    file: `${http}/utils/readResponseText.ts`,
    find: 'if (Number(response.headers.get("content-length")) > bytes) {',
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
    if (!original.includes(find)) {
      throw new Error(`${mutant.file} no longer contains: ${find}`);
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
