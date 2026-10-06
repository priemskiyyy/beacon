import fc from "fast-check";
import { expect, test, vi } from "vitest";

import { parseUtcTimestamp } from "src/utils/parseUtcTimestamp";

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const isLeap = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const countDays = (year: number, month: number) =>
  [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ] ?? 0;

// Whether the calendar has this instant, worked out without the engine's parser.
const exists = ({ year, month, day, hour, minute, second }: Parts) =>
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= countDays(year, month) &&
  hour <= 23 &&
  minute <= 59 &&
  second <= 59;

// The epoch milliseconds of a whole second, worked out without the engine's parser.
const toEpoch = (
  { year, month, day, hour, minute, second }: Parts,
  milliseconds: number,
) => {
  const date = new Date(0);

  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, milliseconds);

  return date.getTime();
};

const pad = (value: number, length: number) =>
  String(value).padStart(length, "0");

const format = ({ year, month, day, hour, minute, second }: Parts) =>
  `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}`;

test("a UTC timestamp is its epoch milliseconds", () => {
  expect(parseUtcTimestamp("2026-09-27T10:00:00Z")).toBe(
    Date.UTC(2026, 8, 27, 10, 0, 0),
  );
  expect(parseUtcTimestamp("1970-01-01T00:00:00Z")).toBe(0);
  expect(parseUtcTimestamp("1969-12-31T23:59:59Z")).toBe(-1_000);
  expect(parseUtcTimestamp("2024-02-29T23:59:59Z")).toBe(
    Date.UTC(2024, 1, 29, 23, 59, 59),
  );
});

test.each([
  [".5", 500],
  [".05", 50],
  [".50", 500],
  [".123", 123],
  [".0", 0],
  [".000", 0],
  [".005", 5],
  [".999", 999],
])(
  "the fraction %s of a second is read as %i milliseconds",
  (fraction, milliseconds) => {
    expect(parseUtcTimestamp(`2026-09-27T10:00:00${fraction}Z`)).toBe(
      Date.UTC(2026, 8, 27, 10, 0, 0) + milliseconds,
    );
  },
);

test("the engine is given whole seconds only, which is all the format it guarantees", () => {
  const parse = vi.spyOn(Date, "parse");

  parseUtcTimestamp("2026-09-27T10:00:00Z");
  parseUtcTimestamp("2026-09-27T10:00:00.5Z");
  parseUtcTimestamp("2026-09-27T10:00:00.05Z");
  parseUtcTimestamp("2026-09-27T10:00:00.123Z");

  expect(parse.mock.calls).toEqual([
    ["2026-09-27T10:00:00Z"],
    ["2026-09-27T10:00:00Z"],
    ["2026-09-27T10:00:00Z"],
    ["2026-09-27T10:00:00Z"],
  ]);
});

test.each([
  ["a date that does not exist", "2026-02-31T10:00:00Z"],
  ["a leap day of a year that has none", "2026-02-29T10:00:00Z"],
  ["a leap day of a century that has none", "2100-02-29T10:00:00Z"],
  ["a month that does not exist", "2026-13-01T10:00:00Z"],
  ["a month zero", "2026-00-10T10:00:00Z"],
  ["a day zero", "2026-09-00T10:00:00Z"],
  ["an hour that does not exist", "2026-09-27T24:00:00Z"],
  ["a minute that does not exist", "2026-09-27T10:60:00Z"],
  ["a leap second", "2026-09-27T10:00:60Z"],
  ["a local time", "2026-09-27T10:00:00+02:00"],
  ["a time without a zone", "2026-09-27T10:00:00"],
  ["a date without a time", "2026-09-27"],
  ["a time of day alone", "10:00:00Z"],
  ["a year", "2026"],
  ["a number that a date parser would read as a date", "12"],
  ["a word", "yesterday"],
  ["a word with a number", "Not a date 5"],
  ["four digits of a second", "2026-09-27T10:00:00.1234Z"],
  ["a fraction with no digits", "2026-09-27T10:00:00.Z"],
  ["a comma for the fraction", "2026-09-27T10:00:00,5Z"],
  ["a lowercase zone", "2026-09-27T10:00:00z"],
  ["a lowercase separator", "2026-09-27t10:00:00Z"],
  ["a space for the separator", "2026-09-27 10:00:00Z"],
  ["a leading space", " 2026-09-27T10:00:00Z"],
  ["a trailing space", "2026-09-27T10:00:00Z "],
  ["a trailing line break", "2026-09-27T10:00:00Z\n"],
  ["an extended year", "+012026-09-27T10:00:00Z"],
  ["digits of another script", "٢٠٢٦-٠٩-٢٧T١٠:٠٠:٠٠Z"],
  ["nothing", ""],
])("%s is not a timestamp", (_name, text) => {
  expect(parseUtcTimestamp(text)).toBeUndefined();
});

const parts = fc.record({
  year: fc.integer({ min: 0, max: 9_999 }),
  month: fc.integer({ min: 0, max: 14 }),
  day: fc.integer({ min: 0, max: 33 }),
  hour: fc.integer({ min: 0, max: 26 }),
  minute: fc.integer({ min: 0, max: 62 }),
  second: fc.integer({ min: 0, max: 62 }),
});

const fraction = fc.option(fc.stringMatching(/^[0-9]{1,3}$/), {
  nil: undefined,
});

test("a timestamp is read when its calendar has the instant, as the exact time the text says, and never otherwise", () => {
  fc.assert(
    fc.property(parts, fraction, (chosen, digits) => {
      const suffix = digits === undefined ? "" : `.${digits}`;
      const text = `${format(chosen)}${suffix}Z`;
      const milliseconds = Number((digits ?? "").padEnd(3, "0"));

      if (!exists(chosen)) {
        expect(parseUtcTimestamp(text)).toBeUndefined();

        return;
      }

      expect(parseUtcTimestamp(text)).toBe(toEpoch(chosen, milliseconds));
    }),
    { numRuns: 2_000 },
  );
});

test("the text an engine writes for any instant is read back as that instant", () => {
  fc.assert(
    fc.property(
      fc.date({
        min: new Date("0000-01-01T00:00:00.000Z"),
        max: new Date("9999-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
      (date) => {
        expect(parseUtcTimestamp(date.toISOString())).toBe(date.getTime());
      },
    ),
    { numRuns: 1_000 },
  );
});

const FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

// Text of any kind, and a real timestamp with one character changed, which is where a lenient parser goes wrong.
const texts = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc
    .tuple(
      fc.date({
        min: new Date("0000-01-01T00:00:00.000Z"),
        max: new Date("9999-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
      fc.nat(23),
      fc.string({ minLength: 1, maxLength: 1 }),
    )
    .map(([date, at, character]) => {
      const text = date.toISOString();

      return `${text.slice(0, at)}${character}${text.slice(at + 1)}`;
    }),
);

test("whatever text arrives, the answer is an instant that the text names in the format, or nothing", () => {
  fc.assert(
    fc.property(texts, (text) => {
      const answer = parseUtcTimestamp(text);

      if (answer === undefined) {
        return;
      }

      expect(FORMAT.test(text)).toBe(true);
      expect(new Date(answer).toISOString().slice(0, 19)).toBe(
        text.slice(0, 19),
      );
    }),
    { numRuns: 3_000 },
  );
});
