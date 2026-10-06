import type { BeaconClock } from "src/types/BeaconClock";
import type { BlockReason } from "src/types/BlockReason";
import type { DisruptionParticipant } from "src/types/DisruptionParticipant";
import type { ReservationOutcome } from "src/types/internal/ReservationOutcome";
import type { ReserveContext } from "src/types/ReserveContext";
import type { ReserveResult } from "src/types/ReserveResult";
import type { Settlement } from "src/types/Settlement";

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

  size = () => this.#registrations.size;

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
      if (!this.#isConcerned(participant, context)) {
        continue;
      }

      const reservation = this.#askToReserve(participant, context);

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

  #isConcerned(participant: DisruptionParticipant, context: ReserveContext) {
    return participant.impacts.some((impact) =>
      context.impacts.includes(impact),
    );
  }

  #askToReserve(
    participant: DisruptionParticipant,
    context: ReserveContext,
  ): ReserveResult {
    try {
      return participant.reserve(context);
    } catch (error) {
      this.#reportError(error);

      return { status: "blocked", code: "reservation-failed" };
    }
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

    const settling = reservation.settle({ signal });

    let cancel = () => {};

    const expired = new Promise<Settlement>((resolve) => {
      cancel = this.#clock.setTimer(
        () => resolve({ status: "blocked", code: "settlement-timeout" }),
        this.#timeout,
      );
    });

    try {
      const settlement = await Promise.race([settling, expired]);

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
