/** A number or a text a row may lack, or nothing. */
export const formatCell = (value: string | number | null) => {
  if (value === null) {
    return "";
  }

  return String(value);
};
