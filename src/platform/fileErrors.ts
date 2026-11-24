export type FileAction = "open" | "save" | "reload";

/**
 * Browser file errors say what failed in their own words ("A requested file or
 * directory could not be found at the time an operation was processed"). This
 * says what happened to the user's file and what they can do next.
 */
export function describeFileError(error: unknown, action: FileAction): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotFoundError":
        return action === "reload"
          ? "The file was renamed, moved or deleted, so it cannot be reloaded. Your open document is unchanged. Use Open to choose the file again, or Save as to write it somewhere new."
          : action === "save"
            ? "The file was renamed, moved or deleted, so Lattice cannot save over it. Your edits are still here. Use Save as to save a copy, or Open to choose the file again."
            : "That file could not be found. It may have been renamed, moved or deleted. Use Open to choose it again.";
      case "NotAllowedError":
      case "SecurityError":
        return "File access was blocked. Use Open to select the file again, or Save as to keep your edits in another file.";
      case "NoModificationAllowedError":
      case "InvalidStateError":
        return "The file cannot be written right now. It may be read-only or in use by another program. Your edits are still here; use Save as to keep them in another file.";
      case "QuotaExceededError":
        return "There is not enough space to save. Free some space, or use Save as to write to another location.";
    }
  }
  return error instanceof Error ? error.message : String(error);
}
