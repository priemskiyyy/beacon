import type { BeaconClock } from "src/types/BeaconClock";
import type { BlockReason } from "src/types/BlockReason";
import type { DisruptionParticipant } from "src/types/DisruptionParticipant";
import type { ReservationOutcome } from "src/types/internal/ReservationOutcome";
import type { ReserveContext } from "src/types/ReserveContext";
import type { ReserveResult } from "src/types/ReserveResult";
import type { Settlement } from "src/types/Settlement";
import { createDeferred } from "src/utils/internal/common/createDeferred";

type DisruptionRegistryOptions = {
  clock: BeaconClock;
  /** Milliseconds a participant may take to settle. */
  timeout: number;
  reportError: (error: unknown) => void;
};

type Held = {
  participant: DisruptionParticipant;
  reservation: Extract<ReserveResult, { status: "reserved" }>;
};

// Each registration is its own entry, so the same participant can register twice.
type Registration = { participant: DisruptionParticipant };

/**
 * Keeps the participants of one Beacon, and takes their reservations for a
 * command in one deterministic order: registration order. A blocked or failing
 * participant releases every reservation taken before it, in reverse.
 */
export class DisruptionRegistry {
  #registrations = new Set<Registration>();
  #revision = 0;
  #clock: BeaconClock;
  #timeout: number;
  #reportError: (error: unknown) => void;

  constructor({ clock, timeout, reportError }: DisruptionRegistryOptions) {
    this.#clock = clock;
    this.#timeout = timeout;
    this.#reportError = reportError;
  }

  /** Grows whenever a participant registers or leaves, so a command can tell that its safety context changed. */
  getRevision = () => this.#revision;

  register = (participant: DisruptionParticipant) => {
    const registration: Registration = { participant };

    this.#registrations.add(registration);
    this.#revision += 1;

    return () => {
      if (!this.#registrations.delete(registration)) {
        return;
      }

      this.#revision += 1;
    };
  };

  /** Closes the admission of every participant the command can disrupt, or refuses at the first that blocks. */
  reserve = (context: ReserveContext): ReservationOutcome => {
    const revision = this.#revision;
    const held: Held[] = [];

    for (const { participant } of [...this.#registrations]) {
      const reservation = this.#askToReserve(participant, context);

      if (reservation === null) {
        continue;
      }

      if (reservation.status === "blocked") {
        this.#release(held);

        return {
          status: "blocked",
          reasons: [
            { code: reservation.code, participant: { name: participant.name } },
          ],
        };
      }

      held.push({ participant, reservation });
    }

    return {
      status: "reserved",
      lease: {
        revision,
        settle: (signal) => this.#settle(held, signal),
        release: () => this.#release(held),
      },
    };
  };

  // What the participant declares and answers is a trust boundary: one that throws, or answers with neither status, refuses the command. `null` is a participant the command cannot disrupt.
  #askToReserve(
    participant: DisruptionParticipant,
    context: ReserveContext,
  ): ReserveResult | null {
    try {
      const isConcerned = participant.impacts.some((impact) =>
        context.impacts.includes(impact),
      );

      if (!isConcerned) {
        return null;
      }

      const reservation = participant.reserve(context);

      if (
        reservation.status === "reserved" ||
        reservation.status === "blocked"
      ) {
        return reservation;
      }
    } catch (error) {
      this.#reportError(error);
    }

    return { status: "blocked", code: "reservation-failed" };
  }

  async #settle(held: Held[], signal: AbortSignal): Promise<BlockReason[]> {
    const reasons = await Promise.all(
      held.map((entry) => this.#settleOne(entry, signal)),
    );

    return reasons.flatMap((reason) => {
      if (reason === null) {
        return [];
      }

      return [reason];
    });
  }

  // A participant that throws or does not answer in time is not ready; silence is never consent.
  async #settleOne(
    { participant, reservation }: Held,
    signal: AbortSignal,
  ): Promise<BlockReason | null> {
    if (reservation.settle === undefined) {
      return null;
    }

    const { settle } = reservation;

    const expired = createDeferred<Settlement>();

    const cancel = this.#clock.setTimer(
      () => expired.resolve({ status: "blocked", code: "settlement-timeout" }),
      this.#timeout,
    );

    // A caller that stops waiting has no use for the deadline, and no timer may outlive it.
    signal.addEventListener("abort", cancel, { once: true });

    try {
      // A settlement that throws at once fails like one that rejects, so the call sits inside the try.
      const settlement = await Promise.race([
        settle({ signal }),
        expired.promise,
      ]);

      if (settlement.status === "ready") {
        return null;
      }

      return { code: settlement.code, participant: { name: participant.name } };
    } catch (error) {
      this.#reportError(error);

      return {
        code: "settlement-failed",
        participant: { name: participant.name },
      };
    } finally {
      signal.removeEventListener("abort", cancel);
      cancel();
    }
  }

  // Every reservation is released even when an earlier release throws.
  #release(held: Held[]) {
    for (const { reservation } of [...held].reverse()) {
      try {
        reservation.release();
      } catch (error) {
        this.#reportError(error);
      }
    }
  }
}
