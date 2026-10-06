import { isolate } from "src/utils/internal/reporting/isolate";
import { reportUnhandledError } from "src/utils/internal/reporting/reportUnhandledError";

// Each call is its own registration, so the same function can be registered twice.
type Registration = { listener: () => void };

export class Listeners {
  #registrations = new Set<Registration>();
  #pass = 0;
  #report: (error: unknown) => void;

  constructor(report: (error: unknown) => void = reportUnhandledError) {
    this.#report = report;
  }

  size = () => this.#registrations.size;

  add = (listener: () => void) => {
    const registration: Registration = { listener };

    this.#registrations.add(registration);

    return () => {
      this.#registrations.delete(registration);
    };
  };

  notify = () => {
    this.#pass += 1;

    const pass = this.#pass;

    for (const registration of [...this.#registrations]) {
      // A nested pass has already reached every listener after a newer change.
      if (pass !== this.#pass) {
        return;
      }

      if (!this.#registrations.has(registration)) {
        continue;
      }

      isolate(registration.listener, this.#report);
    }
  };

  clear = () => {
    this.#pass += 1;
    this.#registrations.clear();
  };
}
