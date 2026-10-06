// One lifetime's cleanups: they run once, in reverse order, and every one is
// attempted even when an earlier one throws. A cleanup registered after the end
// runs at once, so a resource acquired late never outlives its scope.
export class ResourceScope {
  #active = true;
  #cleanups: Array<() => void> = [];
  #report: (error: unknown) => void;

  constructor(report: (error: unknown) => void) {
    this.#report = report;
  }

  isActive = () => this.#active;

  add = (cleanup: () => void) => {
    if (this.#active) {
      this.#cleanups.push(cleanup);

      return;
    }

    this.#run(cleanup);
  };

  dispose = () => {
    if (!this.#active) {
      return;
    }

    this.#active = false;

    let cleanup = this.#cleanups.pop();

    while (cleanup !== undefined) {
      this.#run(cleanup);
      cleanup = this.#cleanups.pop();
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
