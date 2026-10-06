/** A package's label for people, such as `v12`, or `null` when the server gave none: a label that is missing, empty or blank is no label. */
export const readLabel = (label: string) => {
  if (typeof label !== "string" || label.trim() === "") {
    return null;
  }

  return label;
};
