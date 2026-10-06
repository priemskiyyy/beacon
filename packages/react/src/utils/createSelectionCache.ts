/**
 * The cache of one hook's last selection: the same value and selector select
 * once, and a selection equal to the last one keeps the last one's reference,
 * even when a render passes a new selector, so React sees no change.
 */
export const createSelectionCache = <TValue, TSelected>() => {
  let last: {
    value: TValue;
    selector: (value: TValue) => TSelected;
    selected: TSelected;
  } | null = null;

  return (
    value: TValue,
    selector: (value: TValue) => TSelected,
    isEqual: (previous: TSelected, next: TSelected) => boolean,
  ): TSelected => {
    if (
      last !== null &&
      Object.is(last.value, value) &&
      last.selector === selector
    ) {
      return last.selected;
    }

    const selected = selector(value);

    if (last !== null && isEqual(last.selected, selected)) {
      last = { value, selector, selected: last.selected };

      return last.selected;
    }

    last = { value, selector, selected };

    return selected;
  };
};
