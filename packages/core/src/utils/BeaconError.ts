import type { BeaconErrorCode } from "src/types/BeaconErrorCode";

/**
 * An error Beacon created, with a `code` to branch on. Whatever a source,
 * driver or listener threw stays on `cause`, and only on the thrown error:
 * published state keeps the code and message alone.
 *
 * @example
 * ```ts
 * beacon.dispose();
 *
 * try {
 *   beacon.start();
 * } catch (error) {
 *   if (error instanceof BeaconError && error.code === "DISPOSED") {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export class BeaconError extends Error {
  code: BeaconErrorCode;

  constructor({
    code,
    message,
    cause,
  }: {
    code: BeaconErrorCode;
    message: string;
    cause?: unknown;
  }) {
    // `{ cause: undefined }` would still give the error a `cause` of its own.
    super(message, cause === undefined ? undefined : { cause });
    this.name = "BeaconError";
    this.code = code;
  }
}
