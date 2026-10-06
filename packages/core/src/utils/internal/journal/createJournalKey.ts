import type { ReleaseScope } from "src/types/ReleaseScope";
import {
  JOURNAL_NAMESPACE,
  JOURNAL_VERSION,
} from "src/utils/constants/journal";

// With the `u` flag a surrogate that is half of a pair is not matched, only one that has no partner.
const LONE_SURROGATE = /([\uD800-\uDFFF])/u;

// `encodeURIComponent` throws on a lone surrogate. It is written as the three bytes no well-formed text encodes to, so no two scopes share a key.
const encodeLoneSurrogate = (surrogate: string) => {
  const unit = surrogate.charCodeAt(0);

  const bytes = [
    0xe0 | (unit >> 12),
    0x80 | ((unit >> 6) & 0x3f),
    0x80 | (unit & 0x3f),
  ];

  return bytes.map((byte) => `%${byte.toString(16).toUpperCase()}`).join("");
};

const encodePart = (part: string) =>
  part
    .split(LONE_SURROGATE)
    .map((piece, index) => {
      // A split by a capturing pattern alternates the text between with what matched.
      if (index % 2 === 0) {
        return encodeURIComponent(piece);
      }

      return encodeLoneSurrogate(piece);
    })
    .join("");

/** The key of one scope's record, partitioned by application, environment, platform, distribution and the partition when there is one, so no scope reads another's. */
export const createJournalKey = ({
  application,
  environment,
  platform,
  distribution,
  partition,
}: ReleaseScope) =>
  [
    JOURNAL_NAMESPACE,
    `v${JOURNAL_VERSION}`,
    application,
    environment,
    platform,
    distribution,
    ...(partition === undefined ? [] : [partition]),
  ]
    .map(encodePart)
    .join("/");
