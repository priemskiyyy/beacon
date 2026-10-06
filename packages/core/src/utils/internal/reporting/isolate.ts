/** Runs an application callback so that its failure, thrown or rejected, reaches `report` and nothing else. */
export const isolate = (run: () => void, report: (error: unknown) => void) => {
  try {
    const result: unknown = run();

    if (result === undefined) {
      return;
    }

    Promise.resolve(result).catch(report);
  } catch (error) {
    report(error);
  }
};
