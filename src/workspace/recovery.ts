export type RecoveryDocument = { name: string; text: string };
// NUL cannot occur in a native filename, so legacy single-file checkpoints
// cannot accidentally be interpreted as a workspace envelope.
export const WORKSPACE_NAME = "\0json-workbench-workspace-v1";
export function packRecovery(documents: RecoveryDocument[]): RecoveryDocument {
  return { name: WORKSPACE_NAME, text: JSON.stringify(documents) };
}
export function unpackRecovery(draft: RecoveryDocument): RecoveryDocument[] {
  if (draft.name !== WORKSPACE_NAME) return [draft];
  const entries: unknown = JSON.parse(draft.text);
  if (
    !Array.isArray(entries) ||
    !entries.every(
      (d) => d && typeof d.name === "string" && typeof d.text === "string",
    )
  )
    throw new Error(
      "Recovery workspace is invalid. The checkpoint has been retained.",
    );
  return entries;
}
