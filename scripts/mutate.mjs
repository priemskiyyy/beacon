// Mutation checks: each mutant weakens one rule the tests must defend. A
// survivor is either a missing test or dead code. Every changed file is
// restored, and a red baseline stops the run.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const core = "packages/core/src/utils";
const http = "packages/adapters/http/src";

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
    file: `${core}/internal/feeds/FeedRecord.ts`,
    find: "    this.#accepted = null;\n  };",
    replace: "  };",
    project: "core",
    describes: "a revision high-water mark carried into another scope",
  },
  {
    file: `${core}/internal/policy/PolicyRecord.ts`,
    find: "this.#lastValid = null;\n    this.#reported = null;",
    replace: "this.#reported = null;",
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
    file: `${core}/internal/routes/RouteRegistry.ts`,
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
    file: `${http}/http.ts`,
    find: "memory.partition === owner",
    replace: "true",
    project: "http",
    describes: "an answer renewed for another account",
  },
  {
    file: `${http}/utils/parseStandardManifest.ts`,
    find: 'if (readField(record, "schemaVersion") !== SCHEMA_VERSION) {',
    replace: "if (false) {",
    project: "http",
    describes: "an unknown schema version read",
  },
  {
    file: `${http}/utils/readScope.ts`,
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
    file: `${http}/utils/readValidity.ts`,
    find: "if (expiresAt <= now) {",
    replace: "if (false) {",
    project: "http",
    describes: "a stale copy accepted as fresh",
  },
  {
    file: `${http}/utils/readValidity.ts`,
    find: "return Math.min(expiresAt, now + limits.lifetime);",
    replace: "return expiresAt;",
    project: "http",
    describes: "an expiry longer than the local limit",
  },
  {
    file: `${http}/utils/readTimestamp.ts`,
    find: '!new Date(milliseconds).toISOString().startsWith(match[1] ?? "")',
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

  if (!original.includes(mutant.find)) {
    throw new Error(`${mutant.file} no longer contains: ${mutant.find}`);
  }

  writeFileSync(mutant.file, original.replace(mutant.find, mutant.replace));

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
