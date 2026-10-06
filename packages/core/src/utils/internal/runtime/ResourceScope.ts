// Each registration is its own entry, so the same cleanup can be added twice.
type Entry = { cleanup: () => void };

// One lifetime's cleanups: they run once, in reverse order, and every one is
// attempted even when an earlier one throws. A cleanup registered after the end
// runs at once, so a resource acquired late never outlives its scope.
export class ResourceScope {
  #active = true;
  #entries = new Set<Entry>();
  #report: (error: unknown) => void;

  constructor(report: (error: unknown) => void) {
    this.#report = report;
  }

  isActive = () => this.#active;

  /** Registers a cleanup and answers how to take it back once the resource is released early. */
  add = (cleanup: () => void) => {
    if (!this.#active) {
      this.#run(cleanup);

      return () => {};
    }

    const entry: Entry = { cleanup };

    this.#entries.add(entry);

    return () => {
      this.#entries.delete(entry);
    };
  };

  dispose = () => {
    if (!this.#active) {
      return;
    }

    this.#active = false;

    const entries = [...this.#entries].reverse();

    this.#entries.clear();

    for (const entry of entries) {
      this.#run(entry.cleanup);
    }
  };

  #run(cleanup: () => void) {
    try {
      cleanup();
    } catch (error) {
      this.#report(error);
    }
  }
}
