---
description: "Register participants that guard unsaved work, and see how a command reserves, settles, is revalidated and dispatched, and when it is blocked."
---

# Disruptions

Some commands replace the document, restart the runtime or hand the user to a store. Something in your application may be halfway through work that must not be caught by that: a form with unsaved edits, an upload in flight. A **participant** is how you tell Beacon about it.

Beacon orders the steps. The participant owns its own persistence. Nothing here stops work that never asked to be a participant.

## Register a participant

```ts
import type { DisruptionParticipant } from "@priemskiyyy/beacon";

type DraftService = {
  hasUnsavedEdits(): boolean;
  // Refuses new edits until the returned function runs.
  closeAdmission(): () => void;
  save(signal: AbortSignal): Promise<boolean>;
};

export const createDraftParticipant = (
  drafts: DraftService,
): DisruptionParticipant => ({
  name: "drafts",
  impacts: ["document-replacement", "javascript-restart"],
  reserve: () => {
    const reopen = drafts.closeAdmission();

    return {
      status: "reserved",
      settle: async ({ signal }) => {
        if (!drafts.hasUnsavedEdits()) {
          return { status: "ready" };
        }

        if (await drafts.save(signal)) {
          return { status: "ready" };
        }

        return { status: "blocked", code: "draft-not-saved" };
      },
      release: reopen,
    };
  },
});

export const registerDrafts = (drafts: DraftService) =>
  beacon.disruptions.register(createDraftParticipant(drafts));
```

`register` answers a function that unregisters. Register from anywhere, including deep in a component tree. The participant must outlive any reservation it holds, even when its view unmounts, because a reservation is released when the command ends and not when the component does.

A participant has three parts.

- **`impacts`** lists what it cares about. Beacon asks it only before a command whose impacts include one of these. See [commands](commands.md#what-each-command-declares) for the impacts.
- **`reserve(context)`** is asked first. `context` names the route, the command and the impacts. It answers `blocked` with a code, to refuse at once, or `reserved`.
- **`reserved`** carries `release`, which reopens admission, and optionally `settle`, which waits for work already begun and answers `ready` or `blocked` with a code.

## The order of a command

A disruptive call goes through these steps, and nothing is skipped or reordered.

1. **Admit.** The reference is checked. A stale one settles as `stale` before anything is reserved. The call takes its route's slot, and its disruptive slot if it has one. A conflicting call is `blocked` here.
2. **Reserve.** Every participant that cares is asked, synchronously, in registration order. Each closes its admission of new work in that call. If one blocks, the earlier reservations are released in reverse order and the command is `blocked` with that participant's code. A participant that throws, answers neither `reserved` nor `blocked`, or declares no `impacts` is `blocked` with `reservation-failed`, and the reservations before it are released.
3. **Settle.** Every reserved participant settles at once, each with an abort signal and at most `timeouts.settlement` milliseconds (10,000 by default). A participant that answers `blocked`, throws or does not answer in time is not ready. Silence is never consent.
4. **Journal.** A command that replaces the realm writes its intent first, if the [journal](journal.md) is on. A required write that fails stops the command.
5. **Revalidate.** Immediately before the provider is asked, Beacon looks again at the references, the participant registry and the caller's signal. A participant that registered or left while others were settling changes the safety context, and the command is `blocked` with `safety-changed`. A reference that changed is `stale`.
6. **Dispatch.** The provider is asked once.
7. **Release.** When the operation ends, every reservation is released. A cleanup that throws is reported and the rest still run.

A reservation is released when the command ends, except when the command may have taken effect. An accepted command that replaces the realm, and an `indeterminate` one, keep their reservations until `route.acknowledge()`. The old realm may stay alive, and participants must not resume as if nothing was requested. Acknowledging is your explicit choice.

## Blocked and deferred

A blocked command is refused, never queued. Beacon does not remember it and does not retry it. Deferring is the application's job:

```ts
const { observation } = beacon.route("web").state.get();

if (observation.status === "available") {
  const outcome = await beacon
    .route("web")
    .reload({ offer: observation.offer.ref });

  if (outcome.status === "blocked") {
    const codes = outcome.reasons.map((reason) => reason.code);

    console.info("Update after you save:", codes);
  }
}
```

Keep the offer, tell the user what blocks, and call again when it clears. The offer's evidence can lapse meanwhile, and then the call settles as `stale` with `expired`, which is your cue to check again. [Recipes](recipes.md#an-update-banner-that-waits-for-a-saved-form) does this with a form.

The codes are yours, except the ones Beacon raises itself: `operation-in-progress`, `operation-indeterminate`, `safety-changed`, `reservation-failed`, `settlement-timeout` and `settlement-failed` (which is also what a participant gets when the host clock cannot arm its deadline). Each reason names the participant, or is `null` when Beacon refused.

## One slot

- One operation runs per route. An identical call joins it. A different call is blocked with `operation-in-progress`.
- One disruptive command runs across all routes. A second disruptive command on another route is blocked, not queued.
- `may-activate-on-next-start` is not disruptive. It takes no shared slot, and a participant may still list it to be asked.

## Advisory and reserving participants

A participant that only answers a question, such as "is there unsaved work?", is advisory. An edit can begin right after it answered. Beacon claims no atomic safety from such a participant.

A participant that closes its admission in `reserve`, as the example above does with `closeAdmission`, gives the stronger guarantee the coordinator relies on: no new work starts between the answer and the dispatch. Write reserving participants where you can.

All of it is local to one Beacon in one JavaScript instance. One tab reporting itself ready says nothing about another tab, worker or runtime, and a reload the operating system or the user starts never asks Beacon. See [limits](limits.md).

## What the tests prove

Each behaviour above is a row of the verification table. The rows are the names of the tests.

| Behaviour                                                                | Row       |
| ------------------------------------------------------------------------ | --------- |
| an advisory answer claims no atomic safety                               | `SAFE-01` |
| a participant reserves before any settlement begins                      | `SAFE-02` |
| a refusing participant releases the earlier reservations in reverse      | `SAFE-03` |
| a settlement that blocks, throws or takes too long is not ready          | `SAFE-04` |
| a release that throws is reported and the others still run               | `SAFE-05` |
| a participant registered while settling changes the safety context       | `SAFE-06` |
| an offer replaced while the intent is written stops the command          | `SAFE-07` |
| a disruptive command on another route is blocked, not queued             | `SAFE-08` |
| an identical call joins the running one instead of dispatching twice     | `SAFE-09` |
| an abort while participants settle cancels and asks no provider          | `SAFE-10` |
| an abort after the dispatch is `indeterminate`, never `cancelled`        | `SAFE-11` |
| downloading may activate on the next start, which is declared beforehand | `SAFE-12` |
| a reload the operating system starts leaves the safety scope local       | `SAFE-13` |
| a reservation a component held is released when the command ends         | `SAFE-14` |

[Verification](verification.md) counts the rows with a test, not the rows a device has passed.
