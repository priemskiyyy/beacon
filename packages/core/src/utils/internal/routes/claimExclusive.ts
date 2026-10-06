const claimed = new WeakSet<object>();

/**
 * Takes the exclusive use of a native manager, or answers `null` when another
 * session holds it. Whoever claims it calls the release once.
 */
export const claimExclusive = (owner: object): (() => void) | null => {
  if (claimed.has(owner)) {
    return null;
  }

  claimed.add(owner);

  return () => {
    claimed.delete(owner);
  };
};
