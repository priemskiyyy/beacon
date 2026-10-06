export const splitDotted = (value: string | undefined): string[] => {
  if (value === undefined) {
    return [];
  }

  return value.split(".");
};
