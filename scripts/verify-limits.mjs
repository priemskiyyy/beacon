import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The limits a document has to state to keep the library from claiming more
// than it does. A statement that is removed from `docs/limits.md` fails here.
const text = readFileSync("docs/limits.md", "utf8");

const section = (title) => {
  const start = text.indexOf(`## ${title}`);

  assert(start !== -1, `docs/limits.md has no section "${title}".`);

  const rest = text.slice(start + 3);
  const end = rest.indexOf("\n## ");

  return end === -1 ? rest : rest.slice(0, end);
};

const navigation = section("Navigation and reloads outside Beacon");

const safety = section(
  "Disruption safety is local and, unless a participant reserves, advisory",
);

const tabs = section("Cross-tab coordination");
const triggers = section("Checks on an event or a timer");
const published = section("Published values are Beacon's own");
const proof = section("What a test proves");

// WEB-09 A navigation another framework starts is named an external action, and no global guard is claimed.
assert.match(navigation, /installs no global navigation guard and claims none/);

// SAFE-01 An advisory blocker answer claims no atomic safety, and only a reserving participant is stronger.
assert.match(safety, /claims no atomic safety/);
assert.match(safety, /closes its admission before the command dispatches/);

// SAFE-13 An operating-system or user reload that bypasses Beacon leaves the safety scope local.
assert.match(safety, /local to one Beacon in one JavaScript instance/);
assert.match(navigation, /without asking Beacon/);

// SW-09 One tab reporting itself ready asserts nothing about another.
assert.match(tabs, /never asserts the safety of another/);

// SW-16 With no cross-tab lock the documented scope stays local, and no global lock is simulated.
assert.match(tabs, /no simulated global lock/);

// A check on a timer claims no more than the runtime that runs it, and a background runtime may run none.
assert.match(triggers, /makes no runtime run/);
assert.match(triggers, /throttled, suspended or never fire/);

// An away time is an estimate that only throttles, and a reconnect never proves the authority reachable.
assert.match(triggers, /is an estimate that only throttles a check/);
assert.match(triggers, /never that the authority is reachable/);

// A gate is per JavaScript runtime, so another tab is another gate and another read.
assert.match(triggers, /N tabs make N reads/);

// A published value is shared, so a host that writes to one changes what Beacon holds.
assert.match(published, /are the objects Beacon holds, not copies/);
assert.match(published, /changes what Beacon holds/);

// PLAY-18 A suite over a fake bridge is never presented as a verified installation.
assert.match(proof, /never that a Play update installed/);

console.log("Verified the limits that docs/limits.md states.");
