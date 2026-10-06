import { UNAVAILABLE_CODES } from "src/utils/constants/codes";

type Asked<TValue> =
  { status: "answered"; value: TValue } | { status: "refused" };

// The SDK's error is a trust boundary: only its code says why it refused.
const isRefusedHere = (cause: unknown) =>
  typeof cause === "object" &&
  cause !== null &&
  "code" in cause &&
  typeof cause.code === "string" &&
  UNAVAILABLE_CODES.has(cause.code);

/**
 * Makes one call of `expo-updates`. A refusal because this app cannot run
 * updates, which `isEnabled` does not always say, is told apart from a failure:
 * a failure is thrown on, as the SDK raised it.
 */
export const askUpdates = async <TValue>(
  call: () => Promise<TValue>,
): Promise<Asked<TValue>> => {
  try {
    return { status: "answered", value: await call() };
  } catch (cause) {
    if (isRefusedHere(cause)) {
      return { status: "refused" };
    }

    throw cause;
  }
};
