import type { Impact } from "src/types/Impact";

/**
 * What a participant is told when a command asks for its reservation: which
 * route and command, and what the command can do to the running application.
 *
 * @example
 * ```ts
 * const reserve = ({ command, impacts }: ReserveContext) => reservation;
 * ```
 */
export type ReserveContext = {
  route: string;
  command: string;
  impacts: Impact[];
};
