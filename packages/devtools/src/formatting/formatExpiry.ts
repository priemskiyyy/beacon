import { formatDateTime } from "src/formatting/formatDateTime";

/** When evidence stops holding, or that it never does. */
export const formatExpiry = (expiresAt: number | null) => {
  if (expiresAt === null) {
    return "never";
  }

  return formatDateTime(expiresAt);
};
