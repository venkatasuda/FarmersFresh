
export type ReviewResult =
  | { ok: true; verified: boolean }
  | { ok: false; message: string };
