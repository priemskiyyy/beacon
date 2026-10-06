/** What reading the record came to: nothing stored, a stored text, or a storage that failed. */
export type JournalRead =
  | { status: "absent" }
  | { status: "read"; text: string }
  | { status: "failed" };
