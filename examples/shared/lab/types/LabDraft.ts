/** The application's own unsaved work: `dirty` blocks a reload, `locked` while a reload holds its reservation. */
export type LabDraft = { dirty: boolean; locked: boolean };
