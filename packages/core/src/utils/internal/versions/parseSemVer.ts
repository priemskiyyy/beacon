import type { SemVer } from "src/types/SemVer";
import type { SemVerIdentifier } from "src/types/SemVerIdentifier";
import {
  MAX_SEMVER_LENGTH,
  NUMERIC_IDENTIFIER_PATTERN,
  SEMVER_PATTERN,
} from "src/utils/constants/versions";
import { freezeList } from "src/utils/internal/common/freezeList";
import { createInvalidVersionError } from "src/utils/internal/versions/createInvalidVersionError";
import { splitDotted } from "src/utils/internal/versions/splitDotted";

const parseIdentifier = (value: string): SemVerIdentifier => {
  if (NUMERIC_IDENTIFIER_PATTERN.test(value)) {
    return { kind: "numeric", value };
  }

  return { kind: "text", value };
};

/** Parses a strict SemVer 2.0.0 string, guessing nothing: no `v`, no missing component. */
export const parseSemVer = (input: string): SemVer => {
  if (input.length > MAX_SEMVER_LENGTH) {
    throw createInvalidVersionError("semver", input.slice(0, 32));
  }

  const match = SEMVER_PATTERN.exec(input);

  if (match === null) {
    throw createInvalidVersionError("semver", input);
  }

  const [, major, minor, patch, prerelease, build] = match;

  if (major === undefined || minor === undefined || patch === undefined) {
    throw createInvalidVersionError("semver", input);
  }

  return Object.freeze({
    raw: input,
    major,
    minor,
    patch,
    prerelease: freezeList(splitDotted(prerelease).map(parseIdentifier)),
    build: freezeList(splitDotted(build)),
  });
};
