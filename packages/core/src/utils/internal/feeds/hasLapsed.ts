import type { Evidence } from "src/types/Evidence";

/**
 * Whether evidence has stopped holding. The `freshness` it carries is as old as
 * the timer that last set it, and a suspended runtime runs no timer, so the
 * clock decides too.
 */
export const hasLapsed = (
  { freshness, expiresAt }: Evidence,
  now: number,
): boolean =>
  freshness === "expired" || (expiresAt !== null && expiresAt <= now);
