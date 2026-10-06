/**
 * The part of a browser window a reload uses: its location. The real
 * `window` satisfies it.
 *
 * @example
 * ```ts
 * const target: ServiceWorkerWindow = window;
 * ```
 */
export type ServiceWorkerWindow = {
  location: { reload(): void };
};
